# MeetingToNotes

A clean, fast web app that generates AI-powered meeting notes from Zoom and Google Meet links.

## Features

✨ **No Login Required** - Just paste and go
🤖 **Join-as-you Bot** - AI joins the meeting using your display name
🎙️ **Hands-Free Recording** - Live audio capture while you stay focused elsewhere
📝 **AI-Powered Notes** - Clean markdown with timestamps, decisions, and action items
🔄 **Live Status** - Watch your meeting transcribe in real-time
📋 **Easy Export** - Copy to clipboard or download as `.md`
🔗 **Shareable Links** - Share notes and recordings with your team
🌙 **Dark Mode First** - Beautiful design inspired by Linear and Perplexity

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open [http://localhost:3000](http://localhost:3000)**

## Environment Variables

Create a `.env.local` file for API keys (optional for demo):

```env
# Optional: Groq API for AI note generation (faster, free tier)
GROQ_API_KEY=your_groq_api_key

# Optional: Anthropic Claude for higher quality notes
ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional: Vercel KV for production storage
KV_REST_API_URL=your_kv_url
KV_REST_API_TOKEN=your_kv_token
```

**Note:** The app works without API keys using mock data for demo purposes.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **UI Components:** Custom components with shadcn/ui design principles
- **Storage:** Vercel KV (with in-memory fallback)
- **AI:** Groq (Whisper + Llama) or Anthropic (Claude 3.5 Sonnet)
- **Deployment:** Vercel

## Project Structure

```
/app
  /page.tsx                 # Main landing page
  /result/[id]/page.tsx     # Meeting notes result page
  /api
    /join/route.ts          # Meeting join & processing API
    /transcribe/route.ts    # Status check API
/components
  /ui                       # Reusable UI components
/lib
  /utils.ts                 # Utility functions
  /kv.ts                    # Storage adapter
  /prompt.ts                # AI system prompts
```

## How It Works

1. **Submit Link** - User pastes Zoom or Google Meet URL
2. **Extract Meeting ID** - Parse platform and meeting identifier
3. **Join & Record** - Bot joins with your display name (mic/camera off) and immediately starts recording
4. **Transcribe Live** - Audio → text via Whisper API
5. **Generate Notes** - Claude/Groq creates structured notes with:
   - TL;DR summary
   - Timestamped discussion points
   - Decisions made
   - Action items (Owner — Task — Due)
6. **Share** - Notes + recording stored for 7 days with public link

## System Prompt

The AI uses this exact prompt to generate perfect meeting notes every time:

```
You are an expert meeting notes generator. Create clean, professional meeting notes in Markdown format.

Follow this structure exactly:

# Meeting Notes

**TL;DR:** [One powerful sentence summarizing the meeting outcome]

## Discussion Highlights

- [**HH:MM**] Key point or discussion topic
- [**HH:MM**] Important decision or insight
- [**HH:MM**] Notable quote or contribution

## Decisions Made

1. **Decision Title** - Brief explanation of what was decided [**HH:MM**]
2. **Decision Title** - Brief explanation of what was decided [**HH:MM**]

## Action Items

- **Owner** — Complete task description — **Due: Date**
- **Owner** — Complete task description — **Due: Date**

---

Rules:
- Every bullet point must include a timestamp in bold: [**HH:MM**]
- Action items must follow the format: **Owner** — Task — **Due: Date**
- Keep language concise and professional
- Focus on decisions, action items, and key insights
- Use proper Markdown formatting
- Extract exact timestamps from the transcript
```

## Production Implementation

For a full production version, you'll need to implement:

1. **Meeting Bot Integration**
   - Zoom: Use Zoom SDK or Meeting Bot API
   - Google Meet: Use Puppeteer with Google Meet automation

2. **Audio Recording & Transcription**
   - Record audio stream from meeting
   - Use OpenAI Whisper API or Groq Whisper for transcription

3. **Storage**
   - Set up Vercel KV or Supabase
   - Configure environment variables

4. **Security**
   - Rate limiting
   - API key management
   - Meeting access validation

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/meetingtonotes)

```bash
npm run build
vercel
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## License

MIT

## Contributing

Contributions welcome! Open an issue or submit a PR.

---

Built with ❤️ using Next.js, Tailwind, and AI
