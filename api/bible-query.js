const {
  getQueryEmbedding,
  searchPinecone,
  lookupVerseText,
  streamOpenAIResponse,
  generateResponse
} = require('./_shared');

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let responseStarted = false;

  try {
    const { query, stream = false } = req.body;
    console.log('Processing query:', JSON.stringify(query));
    console.log('Stream requested:', stream);

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`Processing query: "${query}"`);

    // 1. Generate embedding for the query
    const embedding = await getQueryEmbedding(query);

    // 2. Search for similar verses in Pinecone
    let references = await searchPinecone(embedding);

    if (references.length === 0) {
      return res.json({
        response: "I couldn't find any Bible verses related to your question. Please try a different question.",
        references: []
      });
    }

    // 3. Look up the verse text from bible-data.js
    references = lookupVerseText(references);

    // Check if we have text for the verses
    const validReferences = references.filter(ref => ref.text && ref.text !== '');
    const hasTextCount = validReferences.length;

    if (hasTextCount === 0) {
      return res.json({
        response: "I've found some relevant Bible passages, but the verse text is missing.",
        references
      });
    }

    // Format verses for prompt
    const formattedVerses = validReferences.map(ref => {
      return `${ref.book} ${ref.chapter}:${ref.verse} - "${ref.text}"`;
    }).join('\n\n');

    // Create prompt for GPT
    const prompt = `${query}\n\nBible verses:\n${formattedVerses}`;

    // Set up messages for the request
    const messages = [
      {
        role: 'system',
        content: `You are Bible Search, a Bible assistant that provides BRIEF, CONCISE answers with proper citations.

CRITICAL: BE BRIEF AND CONCISE. Aim for 100-300 tokens total. Keep responses short and focused.

Write all responses in third-person point of view. Do not use "I", "you", "we", or "us" - maintain an objective, scholarly tone.
Write at a 10th grade reading level - use clear language, avoid complex terminology, and explain concepts simply.

CITATION AND SOURCING REQUIREMENTS:
- Cite every single fact, statement, or Bible reference using [number] notation corresponding to the source verse.
- Integrate citations naturally at the end of sentences or clauses.
- Ensure that every sentence includes at least one citation to a specific Bible verse.
- When referencing scripture, always include book, chapter, and verse followed by citation [number].

FORMATTING REQUIREMENTS (USE MARKDOWN):
- Begin response with "## " heading (level 2 heading) capturing the main point
- Use **bold** for important concepts and teachings
- Always include at least ONE bullet list for key points with citations
- Use concise paragraphs with 1-3 sentences each

CRITICAL: EVERY response MUST include:
1. A heading starting with "## "
2. At least one bullet list with citations
3. Bold text for key concepts using **word**
4. Citations for every statement [number]`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    // Check if client requested streaming response
    if (stream === true) {
      console.log('Streaming response requested');

      try {
        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Send references first
        console.log(`Sending ${references.length} references in the first streaming event`);
        res.write(`data: ${JSON.stringify({references: references})}\n\n`);

        // Send initial content event
        res.write('data: {"content": ""}\n\n');
        responseStarted = true;

        // Begin streaming response
        await streamOpenAIResponse(res, messages, references);

        return;
      } catch (streamError) {
        console.error('Error during streaming response:', streamError);
        console.log('Falling back to standard response');

        if (responseStarted) {
          res.write(`data: {"error": "${streamError.message}"}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
      }
    }

    // Non-streaming response
    console.log('Using standard non-streaming request');
    const response = await generateResponse(query, references);

    // Return both the response and the references
    res.json({
      response,
      references
    });
  } catch (error) {
    console.error('Error processing query:', error);

    if (!responseStarted) {
      res.status(500).json({
        error: 'An error occurred while processing your query',
        details: error.message
      });
    } else {
      try {
        res.write(`data: {"error": "${error.message}"}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (finalError) {
        console.error('Error sending final error message:', finalError);
        try { res.end(); } catch (e) { /* ignore */ }
      }
    }
  }
} 