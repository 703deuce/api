# 🕊️ Bible API on Vercel

AI-powered Bible search and personalized prayer generation API deployed as serverless functions on Vercel.

## 🚀 Features

- **Bible Verse Search**: Semantic search through Bible verses using AI embeddings
- **Personalized Prayers**: AI-generated prayers based on user situations with biblical context
- **Streaming Responses**: Real-time streaming for better user experience
- **Serverless Architecture**: Deployed on Vercel for scalability and reliability

## 📁 Project Structure

```
BC/
├── api/
│   ├── _shared.js           # Shared utilities and functions
│   ├── index.js             # Health check endpoint
│   ├── bible-query.js       # Bible verse search endpoint
│   ├── generate-prayer.js   # Prayer generation endpoint
│   └── status.js            # System status check endpoint
├── embeddings-generator/    # Bible data and embeddings
├── vercel.json             # Vercel deployment configuration
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## 🛠️ Setup & Deployment

### Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com)
3. **Pinecone API Key**: Get from [pinecone.io](https://pinecone.io)

### Environment Variables

Set these in your Vercel dashboard under Project Settings → Environment Variables:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
PINECONE_API_KEY=your-pinecone-api-key-here
```

### Deploy to Vercel

#### Option 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
cd BC
vercel

# Follow the prompts to link your project
# For production deployment:
vercel --prod
```

#### Option 2: GitHub Integration

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on every push

### Local Development

```bash
# Install dependencies
npm install

# Start local development server
vercel dev

# Your API will be available at http://localhost:3000
```

## 🔌 API Endpoints

### Base URL
- **Production**: `https://your-project.vercel.app`
- **Local**: `http://localhost:3000`

### 1. Health Check
```http
GET /api
```

**Response:**
```json
{
  "status": "Bible API Server is running on Vercel",
  "endpoints": [...],
  "timestamp": "2025-05-29T01:00:00.000Z"
}
```

### 2. Bible Verse Search
```http
POST /api/bible-query
Content-Type: application/json

{
  "query": "What does the Bible say about love?",
  "stream": false
}
```

**Response:**
```json
{
  "response": "## God's Love [1][2]\nGod's **love** is unconditional and eternal [1]...",
  "references": [
    {
      "book": "1 John",
      "chapter": 4,
      "verse": 19,
      "text": "We love him, because he first loved us.",
      "score": 0.89
    }
  ]
}
```

**Streaming Response:**
Set `"stream": true` to receive real-time streaming responses via Server-Sent Events.

### 3. Generate Prayer
```http
POST /api/generate-prayer
Content-Type: application/json

{
  "prayerRequest": "I'm struggling with anxiety and need peace",
  "stream": false
}
```

**Response:**
```json
{
  "prayer": "Heavenly Father, I come before You today feeling overwhelmed by anxiety...",
  "verseCount": 5,
  "note": "Prayer inspired by 5 relevant Bible verses"
}
```

### 4. System Status
```http
GET /api/status
```

**Response:**
```json
{
  "status": "connected",
  "pinecone": {
    "index": "bible-verses",
    "namespace": "kjv",
    "recordCount": 31102,
    "dimension": 1536
  },
  "environment": {
    "hasOpenAI": true,
    "hasPinecone": true,
    "runtime": "Vercel Serverless"
  }
}
```

## 🧪 Testing Your API

### Using cURL

```bash
# Test health check
curl https://your-project.vercel.app/api

# Test Bible search
curl -X POST https://your-project.vercel.app/api/bible-query \
  -H "Content-Type: application/json" \
  -d '{"query": "faith and hope"}'

# Test prayer generation
curl -X POST https://your-project.vercel.app/api/generate-prayer \
  -H "Content-Type: application/json" \
  -d '{"prayerRequest": "guidance in difficult times"}'
```

### Using JavaScript

```javascript
// Bible verse search
const response = await fetch('https://your-project.vercel.app/api/bible-query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'What does the Bible say about forgiveness?',
    stream: false
  })
});

const data = await response.json();
console.log(data.response);
console.log(data.references);
```

### Streaming Example

```javascript
// Streaming Bible search
const response = await fetch('https://your-project.vercel.app/api/bible-query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'peace in troubled times',
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      
      try {
        const parsed = JSON.parse(data);
        if (parsed.content) {
          console.log(parsed.content); // Stream content
        }
        if (parsed.references) {
          console.log(parsed.references); // Bible references
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }
  }
}
```

## 🔧 Configuration

### vercel.json Options

```json
{
  "version": 2,
  "functions": {
    "api/*.js": {
      "runtime": "@vercel/node",
      "maxDuration": 30
    }
  },
  "env": {
    "OPENAI_API_KEY": "@openai_api_key",
    "PINECONE_API_KEY": "@pinecone_api_key"
  }
}
```

### Environment Variables Setup

In Vercel Dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add:
   - `OPENAI_API_KEY` → Your OpenAI API key
   - `PINECONE_API_KEY` → Your Pinecone API key

## 📊 Monitoring & Logs

- **Function Logs**: View in Vercel Dashboard → Functions tab
- **Real-time Logs**: Use `vercel logs --follow` with CLI
- **Performance**: Monitor in Vercel Analytics

## 🛡️ CORS Configuration

All endpoints include CORS headers for cross-origin requests:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

## 🚀 Usage in React Native App

```javascript
// In your BibleChat app
const BIBLE_API_URL = 'https://your-project.vercel.app';

const searchBible = async (query) => {
  const response = await fetch(`${BIBLE_API_URL}/api/bible-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      stream: false
    })
  });
  
  return await response.json();
};

const generatePrayer = async (prayerRequest) => {
  const response = await fetch(`${BIBLE_API_URL}/api/generate-prayer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prayerRequest,
      stream: false
    })
  });
  
  return await response.json();
};
```

## 🎯 AdMob Integration

Your Bible API works seamlessly with your BibleChat React Native app that includes AdMob interstitial ads. Users can:

1. **Search Bible verses** → Show interstitial ad after viewing results
2. **Generate prayers** → Show ad after prayer generation
3. **Complete Bible studies** → Show ad between study sessions

## 📈 Scaling

Vercel automatically scales your API based on demand:
- **Concurrent executions**: Up to 1000 per deployment
- **Execution time**: Up to 10 seconds per function (or 30s on Pro)
- **Memory**: 1024 MB per function
- **Bandwidth**: Unlimited

## 🔗 Links

- [Your Live API](https://your-project.vercel.app/api)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [API Documentation](https://your-project.vercel.app/api)

## 📝 License

MIT License - feel free to use and modify for your projects!

---

**Ready to deploy?** Run `vercel` in your terminal and follow the prompts! 🚀 