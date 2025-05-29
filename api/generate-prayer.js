const {
  OPENAI_API_KEY,
  getQueryEmbedding,
  searchPinecone,
  lookupVerseText,
  streamOpenAIResponse
} = require('./_shared');

const axios = require('axios');

// Helper function to create prayer-specific system message
function createPrayerSystemMessage(references) {
  const verseContext = references.length > 0 ? 
    `\n\nUse these Bible verses as inspiration and context (but do not cite them directly in the prayer):\n${references.map(ref => `${ref.book} ${ref.chapter}:${ref.verse} - "${ref.text}"`).join('\n')}` : 
    '';

  return `You are a compassionate prayer assistant that creates personalized, heartfelt prayers rooted in biblical principles.

PRAYER WRITING GUIDELINES:
- Write in first person ("I", "my", "me") as if the person is praying directly to God
- Address God respectfully (Father, Lord, Heavenly Father, etc.)
- Keep the prayer between 100-200 words - meaningful but not overly long
- Use warm, personal, and accessible language
- Include elements of praise, petition, and gratitude where appropriate
- Draw inspiration from biblical themes and principles without directly quoting verses
- Make the prayer specific to the person's situation while maintaining universal appeal
- End with "In Jesus' name, Amen" or similar appropriate closing

PRAYER STRUCTURE:
1. Opening address to God with reverence
2. Brief acknowledgment of God's character or blessings
3. Present the specific need or situation with honesty and humility
4. Ask for God's help, guidance, wisdom, or intervention
5. Express trust in God's plan and timing
6. Close with gratitude and appropriate ending

TONE AND STYLE:
- Sincere and heartfelt, not overly formal or archaic
- Hopeful and faith-filled while acknowledging real struggles
- Personal and intimate, as if speaking to a loving Father
- Avoid clichés or overly complex theological language
- Make it feel authentic and from the heart

${verseContext}`;
}

// Helper function to generate prayer response (non-streaming)
async function generatePrayerResponse(prayerRequest, references) {
  try {
    console.log('Generating prayer with GPT...');
    
    const systemMessage = createPrayerSystemMessage(references);
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          {
            role: 'system',
            content: systemMessage
          },
          {
            role: 'user',
            content: `Please create a personalized prayer for someone who is dealing with: ${prayerRequest}`
          }
        ],
        temperature: 0.8, // Higher temperature for more creative prayers
        max_tokens: 250
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`        
        }
      }
    );
    
    return response.data.choices[0]?.message?.content || 'Unable to generate prayer at this time.';
  } catch (error) {
    console.error('Error generating prayer with OpenAI:', error);
    throw error;
  }
}

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
    const { prayerRequest, stream = false } = req.body;
    console.log('Processing prayer request:', JSON.stringify(prayerRequest));
    console.log('Stream requested:', stream);

    if (!prayerRequest) {
      return res.status(400).json({ error: 'Prayer request is required' });
    }

    console.log(`Processing prayer request: "${prayerRequest}"`);

    // 1. Generate embedding for the prayer request to find relevant Bible verses
    const embedding = await getQueryEmbedding(prayerRequest);

    // 2. Search for similar verses in Pinecone (get more verses for prayer context)
    let references = await searchPinecone(embedding, 10);

    if (references.length === 0) {
      // Generate prayer without biblical context
      const fallbackPrayer = await generatePrayerWithoutVerses(prayerRequest, stream, req, res);
      if (stream && responseStarted) return;

      return res.json({
        prayer: fallbackPrayer,
        references: [],
        note: "Prayer generated without specific Bible verse context"
      });
    }

    // 3. Look up the verse text from bible-data.js
    references = lookupVerseText(references);

    // Filter to only include verses with text for prayer context
    const validReferences = references.filter(ref => ref.text && ref.text !== '');

    // Create prayer-specific system message
    const prayerSystemMessage = createPrayerSystemMessage(validReferences);

    // Set up messages for the prayer request
    const messages = [
      {
        role: 'system',
        content: prayerSystemMessage
      },
      {
        role: 'user',
        content: `Please create a personalized prayer for someone who is dealing with: ${prayerRequest}`
      }
    ];

    // Check if client requested streaming response
    if (stream === true) {
      console.log('Streaming prayer response requested');

      try {
        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Send context info
        console.log(`Using ${validReferences.length} Bible verses as context for prayer generation`);
        res.write(`data: ${JSON.stringify({type: "prayer_context", verseCount: validReferences.length})}\n\n`);

        // Send initial content event
        res.write('data: {"content": ""}\n\n');
        responseStarted = true;

        // Stream the prayer response
        await streamOpenAIResponse(res, messages, []);

        return;
      } catch (streamError) {
        console.error('Error during streaming prayer response:', streamError);
        console.log('Falling back to standard prayer response');

        if (responseStarted) {
          res.write(`data: {"error": "${streamError.message}"}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
      }
    }

    // Non-streaming response
    console.log('Using standard non-streaming prayer request');
    const prayer = await generatePrayerResponse(prayerRequest, validReferences);

    res.json({
      prayer,
      verseCount: validReferences.length,
      note: validReferences.length > 0 ? 
        `Prayer inspired by ${validReferences.length} relevant Bible verses` : 
        "Prayer generated with general biblical principles"
    });

  } catch (error) {
    console.error('Error processing prayer request:', error);

    if (!responseStarted) {
      res.status(500).json({ 
        error: 'An error occurred while generating your prayer',
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

// Helper function to generate prayer without verses (fallback)
async function generatePrayerWithoutVerses(prayerRequest, stream, req, res) {
  const fallbackSystemMessage = `You are a compassionate prayer assistant that creates personalized, heartfelt prayers rooted in biblical principles.

PRAYER WRITING GUIDELINES:
- Write in first person ("I", "my", "me") as if the person is praying directly to God
- Address God respectfully (Father, Lord, Heavenly Father, etc.)
- Keep the prayer between 100-200 words - meaningful but not overly long
- Use warm, personal, and accessible language
- Include elements of praise, petition, and gratitude where appropriate
- Draw from general biblical themes of love, hope, faith, and trust in God
- Make the prayer specific to the person's situation while maintaining universal appeal
- End with "In Jesus' name, Amen" or similar appropriate closing

PRAYER STRUCTURE:
1. Opening address to God with reverence
2. Brief acknowledgment of God's character or blessings
3. Present the specific need or situation with honesty and humility
4. Ask for God's help, guidance, wisdom, or intervention
5. Express trust in God's plan and timing
6. Close with gratitude and appropriate ending

TONE AND STYLE:
- Sincere and heartfelt, not overly formal or archaic
- Hopeful and faith-filled while acknowledging real struggles
- Personal and intimate, as if speaking to a loving Father
- Avoid clichés or overly complex theological language
- Make it feel authentic and from the heart`;

  const messages = [
    {
      role: 'system',
      content: fallbackSystemMessage
    },
    {
      role: 'user',
      content: `Please create a personalized prayer for someone who is dealing with: ${prayerRequest}`
    }
  ];

  if (stream) {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      res.write(`data: ${JSON.stringify({type: "prayer_context", verseCount: 0})}\n\n`);
      res.write('data: {"content": ""}\n\n');
      
      await streamOpenAIResponse(res, messages, []);
      return null; // Response handled by streaming
    } catch (error) {
      console.error('Error streaming fallback prayer:', error);
      throw error;
    }
  } else {
    // Non-streaming fallback
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1-mini-2025-04-14',
        messages: messages,
        temperature: 0.8,
        max_tokens: 250
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`        
        }
      }
    );
    
    return response.data.choices[0]?.message?.content || 'Unable to generate prayer at this time.';
  }
} 