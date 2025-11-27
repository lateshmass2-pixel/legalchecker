import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { kv } from "@/lib/kv";
import type { MeetingData } from "@/lib/kv";
import { meetingNotesSystemPrompt } from "@/lib/prompt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingLink, platform, meetingId } = body;

    if (!meetingLink || !platform || !meetingId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const id = nanoid(10);

    const meetingData: MeetingData = {
      id,
      meetingLink,
      platform,
      meetingId,
      status: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await kv.set(id, meetingData);

    processMeeting(id, platform, meetingId);

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}

async function processMeeting(
  id: string,
  platform: string,
  meetingId: string
) {
  try {
    let data = await kv.get<MeetingData>(id);
    if (!data) return;

    const updateStatus = async (status: MeetingData["status"]) => {
      data = {
        ...data!,
        status,
        updatedAt: Date.now(),
      };
      await kv.set(id, data);
    };

    await updateStatus("connecting");
    await delay(1000);

    await updateStatus("transcribing");
    await delay(2000);

    await updateStatus("processing");

    const mockTranscript = generateMockTranscript(platform, meetingId);
    const notes = await generateNotes(mockTranscript);

    data = {
      ...data,
      status: "done",
      notes,
      updatedAt: Date.now(),
    };

    await kv.set(id, data);
  } catch (error) {
    console.error("Error processing meeting:", error);
    const data = await kv.get<MeetingData>(id);
    if (data) {
      await kv.set(id, {
        ...data,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        updatedAt: Date.now(),
      });
    }
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function generateMockTranscript(platform: string, meetingId: string): string {
  const platformLabel = platform === "zoom" ? "Zoom" : "Google Meet";
  return `Simulated ${platformLabel} meeting (${meetingId})
Meeting started at 10:00 AM

[10:02] Sarah: Good morning everyone, thanks for joining. Let's start with the Q4 roadmap review.

[10:03] Mike: Thanks Sarah. I've prepared the engineering timeline. We're looking at three major features this quarter.

[10:05] Sarah: Great. What's the first priority?

[10:06] Mike: The user authentication overhaul. We need to migrate to OAuth 2.0 and add multi-factor authentication. This is critical for our enterprise customers.

[10:08] Lisa: From the product side, we've had 47 enterprise requests for this feature. It's blocking several major deals.

[10:10] Sarah: Understood. What's the timeline?

[10:11] Mike: Six weeks. We'll need two backend engineers and one security specialist. Start date would be October 15th.

[10:13] Sarah: Approved. Mike, you'll own this. Due date December 1st. What's next?

[10:15] Mike: Second priority is the analytics dashboard redesign. Current metrics show only 23% of users engage with our analytics.

[10:17] Lisa: The UX research shows users find the current interface too complex. We've designed a simplified version with customizable widgets.

[10:19] Sarah: How long for implementation?

[10:20] Mike: Four weeks with two frontend engineers. We can start right after the auth work begins, so around November 1st.

[10:22] Sarah: Good. Lisa, you'll own this one. Target completion early December. Third item?

[10:24] Mike: API rate limiting improvements. We're seeing performance issues with some high-volume customers.

[10:26] David: Infrastructure perspective - this is important. We had two outages last month related to this.

[10:28] Sarah: Timeline?

[10:29] Mike: Three weeks. One backend engineer. Can run in parallel. Start November 1st, complete by November 22nd.

[10:31] Sarah: Approved. David, you own this. Now, any blockers we need to address?

[10:33] Mike: We'll need to hire the security specialist for the auth work. Current team doesn't have OAuth expertise.

[10:35] Sarah: I'll work with HR to expedite this. Target is to have someone by October 10th. Anything else?

[10:37] Lisa: The analytics redesign depends on completing the new component library. Design system team promised it by October 20th.

[10:39] Sarah: I'll follow up with them today. Let's plan a checkpoint meeting in two weeks - October 30th at 10 AM. Everyone mark your calendars.

[10:41] All: Sounds good.

[10:42] Sarah: Great meeting everyone. Thank you.

Meeting ended at 10:43 AM`;
}

async function generateNotes(transcript: string): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!groqApiKey && !anthropicApiKey) {
    return generateFallbackNotes(transcript);
  }

  try {
    if (anthropicApiKey) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `${getMeetingNotesPrompt()}\n\nTranscript:\n${transcript}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.content[0].text;
      }
    }

    if (groqApiKey) {
      const Groq = (await import("groq-sdk")).default;
      const groq = new Groq({ apiKey: groqApiKey });

      const completion = await groq.chat.completions.create({
        model: "llama-3.2-90b-text-preview",
        messages: [
          {
            role: "system",
            content: getMeetingNotesPrompt(),
          },
          {
            role: "user",
            content: `Generate meeting notes from this transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });

      return completion.choices[0]?.message?.content || generateFallbackNotes(transcript);
    }
  } catch (error) {
    console.error("Error generating notes with AI:", error);
  }

  return generateFallbackNotes(transcript);
}

function getMeetingNotesPrompt(): string {
  return meetingNotesSystemPrompt;
}

function generateFallbackNotes(transcript: string): string {
  return `# Meeting Notes

**TL;DR:** Team discussed Q4 roadmap with three major initiatives: OAuth authentication overhaul, analytics dashboard redesign, and API rate limiting improvements.

## Discussion Highlights

- [**10:02**] Sarah opened the Q4 roadmap review meeting
- [**10:06**] Mike presented user authentication overhaul as first priority - OAuth 2.0 migration with multi-factor authentication for enterprise customers
- [**10:08**] Lisa confirmed 47 enterprise requests for this feature, blocking major deals
- [**10:15**] Second priority: analytics dashboard redesign to improve 23% engagement rate
- [**10:17**] UX research shows current interface too complex, new design features customizable widgets
- [**10:24**] Third priority: API rate limiting improvements due to performance issues with high-volume customers
- [**10:26**] David noted two outages last month related to rate limiting
- [**10:33**] Key blocker: need to hire security specialist for OAuth expertise
- [**10:37**] Analytics work depends on new component library from design system team

## Decisions Made

1. **Approve Authentication Overhaul** - Six-week project starting October 15th with two backend engineers and security specialist [**10:13**]
2. **Approve Analytics Dashboard Redesign** - Four-week project starting November 1st with two frontend engineers [**10:22**]
3. **Approve API Rate Limiting Improvements** - Three-week project starting November 1st with one backend engineer [**10:31**]
4. **Schedule Checkpoint Meeting** - Follow-up meeting set for October 30th at 10 AM [**10:39**]

## Action Items

- **Mike** — Lead user authentication overhaul project — **Due: December 1st**
- **Lisa** — Own analytics dashboard redesign implementation — **Due: Early December**
- **David** — Implement API rate limiting improvements — **Due: November 22nd**
- **Sarah** — Work with HR to hire security specialist — **Due: October 10th**
- **Sarah** — Follow up with design system team on component library — **Due: October 20th**

---

*Meeting Duration: 43 minutes*`;
}
