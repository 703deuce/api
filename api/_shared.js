const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');

// API keys - use environment variables only
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;

// Validate required environment variables
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

if (!PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY environment variable is required');
}

// Pinecone settings
const INDEX_NAME = 'bible-verses';
const NAMESPACE = 'kjv';

// Cache for bible data to avoid loading it repeatedly
let bibleDataCache = null;

// Get embedding for a query
async function getQueryEmbedding(query) {
  try {
    console.log(`Getting embedding for query: "${query}"`);
    
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        input: query,
        model: 'text-embedding-3-small'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );
    
    console.log('Successfully generated query embedding');
    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error generating query embedding:', error.response?.data || error.message);
    throw error;
  }
}

// Search Pinecone for similar verses
async function searchPinecone(queryEmbedding, topK = 5) {
  try {
    console.log('Initializing Pinecone client...');
    
    const pc = new Pinecone({
      apiKey: PINECONE_API_KEY
    });
    
    console.log('Pinecone client initialized');
    
    const index = pc.index(INDEX_NAME);
    const namespace = index.namespace(NAMESPACE);
    
    console.log(`Querying namespace '${NAMESPACE}' in index '${INDEX_NAME}'...`);
    
    const results = await namespace.query({
      topK,
      vector: queryEmbedding,
      includeValues: true,
      includeMetadata: true
    });
    
    console.log(`Got ${results.matches?.length || 0} results from Pinecone`);
    
    const matches = results.matches?.map(match => {
      const metadata = match.metadata || {};
      
      const result = {
        book: metadata.book || '',
        chapter: parseInt(metadata.chapter || '0'),
        verse: parseInt(metadata.verse || metadata.startVerse || '0'),
        text: metadata.text || '',
        score: match.score || 0
      };
      
      if (!result.text && result.book && result.chapter && result.verse) {
        result.text = `[Verse text not available in database]`;
        result.needsTextLookup = true;
      }
      
      return result;
    }) || [];
    
    return matches;
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    throw error;
  }
}

// Load bible data with caching
function loadBibleData() {
  if (bibleDataCache) {
    return bibleDataCache;
  }
  
  try {
    // In serverless environment, we need to handle the path differently
    const path = require('path');
    const fs = require('fs');
    
    // Try to load from embeddings-generator folder
    const bibleDataPath = path.join(process.cwd(), 'embeddings-generator', 'bible-data.js');
    
    if (fs.existsSync(bibleDataPath)) {
      const bibleModule = require(bibleDataPath);
      if (bibleModule && bibleModule.bibleData && Array.isArray(bibleModule.bibleData)) {
        bibleDataCache = bibleModule.bibleData;
        console.log(`Loaded ${bibleDataCache.length} verses from bible-data.js`);
        return bibleDataCache;
      }
    }
    
    console.log('Bible data not found or invalid format');
    return [];
  } catch (error) {
    console.error('Error loading bible data:', error);
    return [];
  }
}

// Look up verse text from bible-data.js
function lookupVerseText(references) {
  console.log('Looking up verse text from bible-data.js');
  
  try {
    const bibleData = loadBibleData();
    
    if (bibleData.length === 0) {
      console.error('No bible data available for text lookup');
      return references;
    }
    
    const enhancedReferences = references.map(ref => {
      const verse = bibleData.find(v => 
        v.book === ref.book && 
        v.chapter === ref.chapter && 
        v.verse === ref.verse
      );
      
      if (verse && verse.text) {
        return {
          ...ref,
          text: verse.text
        };
      }
      return ref;
    });
    
    const beforeCount = references.filter(ref => !ref.text || ref.text === '').length;
    const afterCount = enhancedReferences.filter(ref => !ref.text || ref.text === '').length;
    console.log(`Text lookup: filled in ${beforeCount - afterCount} of ${beforeCount} missing texts`);
    
    return enhancedReferences;
  } catch (error) {
    console.error('Error looking up verse text:', error);
    return references;
  }
}

// Get specific verse by reference
function getVerseByReference(book, chapter, verse) {
  try {
    const bibleData = loadBibleData();
    
    if (bibleData.length === 0) {
      return null;
    }
    
    const normalizedBook = normalizeBookName(book);
    
    const foundVerse = bibleData.find(v => 
      (v.book === book || v.book === normalizedBook) && 
      v.chapter === parseInt(chapter) && 
      v.verse === parseInt(verse)
    );
    
    return foundVerse || null;
  } catch (error) {
    console.error('Error looking up specific verse:', error);
    return null;
  }
}

// Helper function to normalize book names
function normalizeBookName(book) {
  const bookMappings = {
    'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers',
    'Deut': 'Deuteronomy', 'Josh': 'Joshua', 'Judg': 'Judges', '1Sam': '1 Samuel',
    '2Sam': '2 Samuel', '1Kgs': '1 Kings', '2Kgs': '2 Kings', '1Chr': '1 Chronicles',
    '2Chr': '2 Chronicles', 'Ps': 'Psalms', 'Prov': 'Proverbs', 'Eccl': 'Ecclesiastes',
    'Isa': 'Isaiah', 'Jer': 'Jeremiah', 'Lam': 'Lamentations', 'Ezek': 'Ezekiel',
    'Dan': 'Daniel', 'Hos': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos',
    'Obad': 'Obadiah', 'Jon': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum',
    'Hab': 'Habakkuk', 'Zeph': 'Zephaniah', 'Hag': 'Haggai', 'Zech': 'Zechariah',
    'Mal': 'Malachi', 'Matt': 'Matthew', 'Mk': 'Mark', 'Lk': 'Luke',
    'Jn': 'John', 'Rom': 'Romans', '1Cor': '1 Corinthians', '2Cor': '2 Corinthians',
    'Gal': 'Galatians', 'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians',
    '1Thess': '1 Thessalonians', '2Thess': '2 Thessalonians', '1Tim': '1 Timothy',
    '2Tim': '2 Timothy', 'Tit': 'Titus', 'Phlm': 'Philemon', 'Heb': 'Hebrews',
    'Jas': 'James', '1Pet': '1 Peter', '2Pet': '2 Peter', '1Jn': '1 John',
    '2Jn': '2 John', '3Jn': '3 John', 'Rev': 'Revelation'
  };

  return bookMappings[book] || book;
}

// Stream response from OpenAI
async function streamOpenAIResponse(res, messages, references) {
  try {
    console.log('Streaming response with gpt-4.1-mini-2025-04-14...');
    
    // Send references first
    res.write(`data: ${JSON.stringify({ type: "references", references: references })}\n\n`);
    
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: messages,
        temperature: 0.7,
        max_tokens: 300,
        stream: true
      })
    };
    
    const fetchResponse = await fetch('https://api.openai.com/v1/chat/completions', fetchOptions);
    
    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }
    
    const reader = fetchResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        res.write('data: [DONE]\n\n');
        break;
      }
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data.trim() === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';
            
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
              fullResponse += content;
            }
          } catch (e) {
            // Skip malformed JSON chunks
          }
        }
      }
    }
    
    return fullResponse;
  } catch (error) {
    console.error('Error streaming response from OpenAI:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    throw error;
  }
}

// Generate non-streaming response
async function generateResponse(query, references) {
  try {
    console.log('Generating response with gpt-4.1-mini-2025-04-14...');
    
    const validReferences = references.filter(ref => ref.text && ref.text.trim() !== '');
    
    if (validReferences.length === 0) {
      return "I couldn't find Bible verses with text content to answer your question.";
    }
    
    const formattedVerses = validReferences.map(ref => {
      return `${ref.book} ${ref.chapter}:${ref.verse} - "${ref.text}"`;
    }).join('\n\n');
    
    const prompt = `${query}\n\nBible verses:\n${formattedVerses}`;
    
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

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1-mini-2025-04-14',
        messages: messages,
        temperature: 0.7,
        max_tokens: 300
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`        
        }
      }
    );
    
    return response.data.choices[0]?.message?.content || 'No response generated';
  } catch (error) {
    console.error('Error generating response with OpenAI:', error);
    throw error;
  }
}

module.exports = {
  OPENAI_API_KEY,
  PINECONE_API_KEY,
  INDEX_NAME,
  NAMESPACE,
  getQueryEmbedding,
  searchPinecone,
  lookupVerseText,
  getVerseByReference,
  normalizeBookName,
  streamOpenAIResponse,
  generateResponse,
  loadBibleData
}; 