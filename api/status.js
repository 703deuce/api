const { Pinecone } = require('@pinecone-database/pinecone');
const { PINECONE_API_KEY, INDEX_NAME, NAMESPACE } = require('./_shared');

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Checking Pinecone status...');
    
    // Initialize Pinecone
    const pc = new Pinecone({
      apiKey: PINECONE_API_KEY
    });
    
    // Get the index and namespace
    const index = pc.index(INDEX_NAME);
    const namespace = index.namespace(NAMESPACE);
    
    // Get simple statistics
    const stats = await index.describeIndexStats();
    
    // Run a test query to get sample data
    const sampleQuery = await namespace.query({
      topK: 1,
      vector: Array(1536).fill(0).map(() => Math.random() - 0.5), // Random vector for testing
      includeValues: false,
      includeMetadata: true
    });
    
    const sampleMatchMetadata = sampleQuery.matches && sampleQuery.matches.length > 0 
      ? sampleQuery.matches[0].metadata 
      : null;
    
    res.json({
      status: 'connected',
      pinecone: {
        index: INDEX_NAME,
        namespace: NAMESPACE,
        recordCount: stats.totalVectorCount,
        namespaces: stats.namespaces,
        dimension: stats.dimension
      },
      sampleMetadataKeys: sampleMatchMetadata ? Object.keys(sampleMatchMetadata) : [],
      sampleMetadata: sampleMatchMetadata,
      environment: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasPinecone: !!process.env.PINECONE_API_KEY,
        runtime: 'Vercel Serverless'
      }
    });
  } catch (error) {
    console.error('Error checking Pinecone status:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      config: {
        index: INDEX_NAME,
        namespace: NAMESPACE
      },
      environment: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasPinecone: !!process.env.PINECONE_API_KEY,
        runtime: 'Vercel Serverless'
      }
    });
  }
} 