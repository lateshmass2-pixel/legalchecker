# Deployment Guide

## Quick Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-repo-url
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Click "Deploy"

3. **Add Environment Variables (Optional):**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add your API keys:
     - `GROQ_API_KEY` (for AI note generation)
     - `ANTHROPIC_API_KEY` (alternative to Groq)
     - `KV_REST_API_URL` (for Vercel KV storage)
     - `KV_REST_API_TOKEN` (for Vercel KV storage)

## Vercel KV Setup

1. In Vercel dashboard, go to Storage tab
2. Create a new KV Database
3. Link it to your project
4. Environment variables will be added automatically

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env.local`:**
   ```env
   # Optional - app works without these
   GROQ_API_KEY=your_groq_key
   ANTHROPIC_API_KEY=your_anthropic_key
   ```

3. **Run dev server:**
   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)**

## Production Checklist

For a production-ready version, implement:

### 1. Real Meeting Bot Integration

**Zoom:**
```typescript
// Use Zoom Meeting SDK or Bot API
import { ZoomMeetingSDK } from '@zoom/meetingsdk';

async function joinZoomMeeting(meetingId: string, password?: string) {
  // Initialize bot
  // Join meeting as participant with mic/camera off
  // Record audio stream
}
```

**Google Meet:**
```typescript
// Use Puppeteer to automate browser
import puppeteer from 'puppeteer';

async function joinGoogleMeet(meetingLink: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  // Navigate to meeting
  // Turn off mic/camera
  // Record audio
}
```

### 2. Audio Transcription

**Option A: Groq Whisper (Fast & Free)**
```typescript
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function transcribe(audioFile: File) {
  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-large-v3",
    language: "en",
    response_format: "verbose_json",
  });
  return transcription;
}
```

**Option B: OpenAI Whisper**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribe(audioFile: File) {
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    response_format: "verbose_json",
  });
  return transcription;
}
```

### 3. Note Generation

Already implemented! The app supports:
- **Groq** (Llama 3.2 90B) - Fast, free tier available
- **Anthropic** (Claude 3.5 Sonnet) - Higher quality

### 4. Security & Rate Limiting

```typescript
// middleware.ts
import { ratelimit } from '@/lib/rate-limit';

export async function middleware(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
}
```

### 5. Monitoring & Analytics

- Set up error tracking (Sentry)
- Add analytics (Vercel Analytics)
- Monitor API usage and costs

## Environment Variables Reference

```env
# AI Services (at least one required for AI generation)
GROQ_API_KEY=gsk_xxx                    # Groq API key
ANTHROPIC_API_KEY=sk-ant-xxx            # Anthropic API key
OPENAI_API_KEY=sk-xxx                   # OpenAI API key (for Whisper)

# Storage (optional - uses in-memory store if not set)
KV_REST_API_URL=https://xxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxx

# Meeting Integration (for production)
ZOOM_SDK_KEY=xxx
ZOOM_SDK_SECRET=xxx
GOOGLE_MEET_CLIENT_ID=xxx
GOOGLE_MEET_CLIENT_SECRET=xxx
```

## API Endpoints

### POST /api/join
Submit a meeting link for processing.

**Request:**
```json
{
  "meetingLink": "https://zoom.us/j/123456789",
  "platform": "zoom",
  "meetingId": "123456789"
}
```

**Response:**
```json
{
  "id": "abc123xyz"
}
```

### GET /api/transcribe?id={id}
Check status of a meeting transcription.

**Response:**
```json
{
  "id": "abc123xyz",
  "status": "done",
  "notes": "# Meeting Notes\n\n...",
  "createdAt": 1699999999999,
  "updatedAt": 1699999999999
}
```

## Performance Tips

1. **Edge Functions:** API routes automatically deploy to edge
2. **Static Generation:** Home page is pre-rendered
3. **Code Splitting:** Next.js automatically splits code
4. **Image Optimization:** Use `next/image` for icons/logos

## Cost Estimates

**Free Tier (Demo):**
- Vercel: Free hosting + 100GB bandwidth
- Groq: Free tier available
- In-memory storage: Free

**Production (~1000 meetings/month):**
- Vercel Pro: $20/mo
- Groq: ~$5-10/mo
- Vercel KV: ~$5/mo
- **Total: ~$30-35/mo**

## Support

- Documentation: See README.md
- Issues: GitHub Issues
- Community: Discord/Twitter

---

Built with Next.js 15 + Tailwind CSS + AI
