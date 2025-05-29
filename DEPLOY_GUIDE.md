# 🚀 Quick Deployment Guide

## Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

## Step 2: Navigate to Project

```bash
cd BC
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Deploy to Vercel

```bash
vercel
```

Follow the prompts:
- **Set up and deploy "BC"?** → `Y`
- **Which scope?** → Choose your Vercel account
- **Link to existing project?** → `N` (for new project)
- **What's your project's name?** → `bible-api` (or your preferred name)
- **In which directory is your code located?** → `./` (current directory)

## Step 5: Set Environment Variables

After deployment, go to your Vercel dashboard:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Find your `bible-api` project
3. Click **Settings** → **Environment Variables**
4. Add these variables:

```
OPENAI_API_KEY = sk-your-openai-key-here
PINECONE_API_KEY = your-pinecone-key-here
```

## Step 6: Redeploy with Environment Variables

```bash
vercel --prod
```

## Step 7: Test Your API

Your API will be available at the URL provided by Vercel (e.g., `https://bible-api-xyz.vercel.app`)

Test endpoints:
- `GET https://your-url.vercel.app/api` - Health check
- `POST https://your-url.vercel.app/api/bible-query` - Bible search
- `POST https://your-url.vercel.app/api/generate-prayer` - Prayer generation
- `GET https://your-url.vercel.app/api/status` - System status

## 🎉 Done!

Your Bible API is now live and ready to use with your React Native app with AdMob interstitial ads!

## Next Steps

1. Update your React Native app to use the new API URL
2. Test the integration with your AdMob ads
3. Monitor usage in Vercel dashboard
4. Scale as needed

## Troubleshooting

- **500 errors**: Check environment variables are set correctly
- **404 errors**: Ensure all files are in the `/api` folder
- **Function timeouts**: Check Pinecone and OpenAI connectivity

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support) 