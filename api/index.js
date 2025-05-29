export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests for health check
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.json({ 
    status: 'Bible API Server is running on Vercel',
    endpoints: [
      '/api/bible-query (POST) - Search Bible verses',
      '/api/generate-prayer (POST) - Generate personalized prayers',
      '/api/status (GET) - Check Pinecone connection status'
    ],
    timestamp: new Date().toISOString()
  });
} 