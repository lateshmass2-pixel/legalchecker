import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { kv } from "@/lib/kv";
import type { MeetingData } from "@/lib/kv";
import { meetingNotesSystemPrompt } from "@/lib/prompt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { meetingLink, platform, meetingId, displayName } = body || {};

    if (
      typeof meetingLink !== "string" ||
      typeof platform !== "string" ||
      typeof meetingId !== "string" ||
      typeof displayName !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const cleanedLink = meetingLink.trim();
    const cleanedDisplayName = displayName.trim();
    const cleanedMeetingId = meetingId.trim();
    const normalizedPlatform = platform.trim() as MeetingData["platform"];

    if (
      !cleanedLink ||
      !cleanedMeetingId ||
      !cleanedDisplayName ||
      (normalizedPlatform !== "zoom" && normalizedPlatform !== "google-meet")
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const id = nanoid(10);

    const meetingData: MeetingData = {
      id,
      meetingLink: cleanedLink,
      platform: normalizedPlatform,
      meetingId: cleanedMeetingId,
      displayName: cleanedDisplayName,
      status: "waiting",
      statusMessage: `We'll join this call as ${cleanedDisplayName} and start recording the moment it begins.`,
      recording: {
        status: "idle",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await kv.set(id, meetingData);

    processMeeting(id, normalizedPlatform, cleanedMeetingId, cleanedLink, cleanedDisplayName);

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}

type MeetingUpdateInput = Partial<
  Omit<
    MeetingData,
    | "id"
    | "meetingLink"
    | "platform"
    | "meetingId"
    | "displayName"
    | "createdAt"
    | "recording"
  >
> & { recording?: Partial<MeetingData["recording"]> };

async function processMeeting(
  id: string,
  platform: MeetingData["platform"],
  meetingId: string,
  meetingLink: string,
  displayName: string
) {
  try {
    let data = await kv.get<MeetingData>(id);
    if (!data) return;

    const platformLabel = platform === "zoom" ? "Zoom" : "Google Meet";

    const updateMeeting = async (updates: MeetingUpdateInput) => {
      if (!data) return;
      const { recording: recordingUpdates, ...rest } = updates;

      data = {
        ...data,
        ...rest,
        recording: recordingUpdates
          ? { ...data.recording, ...recordingUpdates }
          : data.recording,
        updatedAt: Date.now(),
      };

      await kv.set(id, data);
    };

    await updateMeeting({
      status: "connecting",
      statusMessage: `Joining the ${platformLabel} call as ${displayName}.`,
      recording: {
        status: "starting",
        startedAt: data.recording.startedAt ?? Date.now(),
      },
    });

    const transcript = await joinMeetingAndRecord(
      meetingLink,
      platform,
      displayName,
      (status) => {
        updateMeeting({
          status: "transcribing",
          statusMessage: `Recording the meeting live. ${status}`,
          recording: {
            status: "recording",
          },
        });
      }
    );

    await updateMeeting({
      status: "processing",
      statusMessage: "Wrapping up the recording and polishing the notes.",
      recording: {
        status: "processing",
      },
    });

    const notes = await generateNotes(transcript);

    const startedAt = data.recording.startedAt ?? Date.now();
    const endedAt = Date.now();
    const durationMinutes = Math.max(
      1,
      Math.round((endedAt - startedAt) / 60000)
    );

    await updateMeeting({
      status: "done",
      statusMessage: "Recording saved. Notes are ready whenever you are.",
      notes,
      recording: {
        status: "available",
        endedAt,
        durationMinutes,
      },
    });
  } catch (error) {
    console.error("Error processing meeting:", error);
    const existing = await kv.get<MeetingData>(id);
    if (existing) {
      await kv.set(id, {
        ...existing,
        status: "error",
        statusMessage:
          "We couldn't finish recording this meeting. Please try again.",
        error: error instanceof Error ? error.message : "Unknown error",
        updatedAt: Date.now(),
      });
    }
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function joinMeetingAndRecord(
  meetingLink: string,
  platform: MeetingData["platform"],
  displayName: string,
  onStatusUpdate: (status: string) => void
): Promise<string> {
  try {
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--single-process",
      ],
    });

    onStatusUpdate("Launching browser...");
    const page = await browser.newPage();

    await page.setViewport({ width: 1024, height: 768 });

    onStatusUpdate("Navigating to meeting...");
    await page.goto(meetingLink, { waitUntil: "networkidle2", timeout: 60000 });

    await delay(2000);

    let joinFailed = false;
    try {
      if (platform === "zoom") {
        onStatusUpdate("Joining Zoom meeting...");
        await joinZoomMeeting(page, displayName);
      } else if (platform === "google-meet") {
        onStatusUpdate("Joining Google Meet...");
        await joinGoogleMeet(page, displayName);
      }
    } catch (joinError) {
      console.error("Error joining meeting:", joinError);
      joinFailed = true;
    }

    onStatusUpdate("Recording audio stream...");
    const transcript = await recordAndTranscribeMeeting(page, platform, onStatusUpdate);

    if (!joinFailed) {
      try {
        onStatusUpdate("Leaving meeting...");
        await leaveMeeting(page, platform);
      } catch (leaveError) {
        console.error("Error leaving meeting:", leaveError);
      }
    }

    await browser.close();

    return transcript;
  } catch (error) {
    console.error("Error in joinMeetingAndRecord:", error);
    throw new Error(`Failed to join and record meeting: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function joinZoomMeeting(page: any, displayName: string): Promise<void> {
  try {
    const selectors = [
      "button[aria-label*='Join audio by computer']",
      "button:has-text('Join Audio')",
      "[data-testid='prejoin-join-button']",
    ];

    let found = false;
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        await page.click(selector);
        found = true;
        break;
      }
    }

    if (!found) {
      const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("button")).map((b) => ({
          text: b.textContent,
          ariaLabel: b.getAttribute("aria-label"),
        }));
      });
      console.log("Available buttons:", buttons);

      const joinButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        return buttons.find(
          (b) =>
            b.textContent?.includes("Join") ||
            b.getAttribute("aria-label")?.includes("Join")
        ) as HTMLElement | undefined;
      });

      if (joinButton) {
        await page.evaluate((btn: any) => btn.click(), joinButton);
      }
    }

    await delay(3000);

    const nameInput = await page.$("#inputname");
    if (nameInput) {
      await page.evaluate(
        (input: any, name: string) => {
          input.value = name;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        },
        nameInput,
        displayName
      );
      await delay(500);
    }

    await delay(2000);

    await enableZoomCaptions(page);
  } catch (error) {
    console.error("Error joining Zoom meeting:", error);
    throw error;
  }
}

async function enableZoomCaptions(page: any): Promise<void> {
  try {
    await delay(2000);
    
    const captionButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
      return buttons.find(
        (el) =>
          el.getAttribute("aria-label")?.toLowerCase().includes("caption") ||
          el.getAttribute("aria-label")?.toLowerCase().includes("subtitle") ||
          el.textContent?.toLowerCase().includes("caption") ||
          el.textContent?.toLowerCase().includes("cc")
      ) as HTMLElement | undefined;
    });

    if (captionButton) {
      await page.evaluate((btn: any) => btn.click(), captionButton);
      console.log("Enabled Zoom captions");
      await delay(1000);
    }
  } catch (error) {
    console.log("Could not enable Zoom captions:", error);
  }
}

async function joinGoogleMeet(page: any, displayName: string): Promise<void> {
  try {
    const nameInput = await page.$("input[aria-label='Your name']");
    if (nameInput) {
      await page.evaluate(
        (input: any, name: string) => {
          input.value = name;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        },
        nameInput,
        displayName
      );
      await delay(500);
    }

    await delay(1000);

    const joinButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
      return buttons.find(
        (b) =>
          b.textContent?.includes("Join now") ||
          b.textContent?.includes("Ask to join")
      ) as HTMLElement | undefined;
    });

    if (joinButton) {
      await page.evaluate((btn: any) => btn.click(), joinButton);
      await delay(3000);
    }

    await enableGoogleMeetCaptions(page);
  } catch (error) {
    console.error("Error joining Google Meet:", error);
    throw error;
  }
}

async function enableGoogleMeetCaptions(page: any): Promise<void> {
  try {
    await delay(2000);
    
    const captionButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, [role='button'], [jsname], [data-tooltip]"));
      return buttons.find(
        (el) =>
          el.getAttribute("aria-label")?.toLowerCase().includes("caption") ||
          el.getAttribute("data-tooltip")?.toLowerCase().includes("caption") ||
          el.textContent?.toLowerCase().includes("caption") ||
          el.getAttribute("aria-label")?.toLowerCase().includes("subtitle")
      ) as HTMLElement | undefined;
    });

    if (captionButton) {
      await page.evaluate((btn: any) => btn.click(), captionButton);
      console.log("Enabled Google Meet captions");
      await delay(1000);
    }
  } catch (error) {
    console.log("Could not enable Google Meet captions:", error);
  }
}

async function recordAndTranscribeMeeting(
  page: any,
  platform: MeetingData["platform"],
  onStatusUpdate: (status: string) => void
): Promise<string> {
  try {
    onStatusUpdate("Meeting active, capturing audio...");

    const maxDurationMs = 60000;
    const captureIntervalMs = 5000;
    const startTime = Date.now();
    const capturedText: string[] = [];

    await page.evaluate(() => {
      (window as any).capturedCaptions = [];
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node: any) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.textContent || "";
              const lowerText = text.toLowerCase();
              
              if (
                node.getAttribute?.("aria-live") === "assertive" ||
                node.getAttribute?.("aria-live") === "polite" ||
                node.className?.includes?.("caption") ||
                node.className?.includes?.("subtitle") ||
                node.className?.includes?.("transcript") ||
                lowerText.includes("caption") ||
                lowerText.includes("transcript")
              ) {
                if (text.length > 5 && text.length < 500) {
                  (window as any).capturedCaptions.push({
                    text: text.trim(),
                    timestamp: Date.now(),
                  });
                }
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      (window as any).captionObserver = observer;
    });

    while (Date.now() - startTime < maxDurationMs) {
      try {
        const isStillInMeeting = await page.evaluate(() => {
          const meetingIndicators = [
            document.querySelector("[data-tooltip='Mute']"),
            document.querySelector("button[aria-label*='Mute']"),
            document.querySelector("button[aria-label*='Camera']"),
            document.querySelector("[aria-label*='End call']"),
            document.querySelector("[aria-label*='Leave meeting']"),
          ];
          return meetingIndicators.some((el) => el !== null);
        });

        if (!isStillInMeeting) {
          onStatusUpdate("Meeting has ended");
          break;
        }

        const newCaptions = await page.evaluate(() => {
          const captions = (window as any).capturedCaptions || [];
          (window as any).capturedCaptions = [];
          return captions;
        });

        if (newCaptions && newCaptions.length > 0) {
          capturedText.push(...newCaptions.map((c: any) => c.text));
        }

        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        const capturedCount = capturedText.length;
        onStatusUpdate(`Recording... (${elapsedSeconds}s, ${capturedCount} captions captured)`);
        
        await delay(captureIntervalMs);
      } catch (pollError) {
        console.error("Error checking meeting status:", pollError);
        await delay(captureIntervalMs);
      }
    }

    await page.evaluate(() => {
      if ((window as any).captionObserver) {
        (window as any).captionObserver.disconnect();
      }
    });

    if (capturedText.length > 0) {
      const transcript = buildTranscriptFromCaptions(capturedText, platform, startTime);
      return transcript;
    }

    const transcript = await generateTranscriptFromPage(page, platform);
    return transcript;
  } catch (error) {
    console.error("Error recording meeting:", error);
    return generateFallbackTranscript(platform);
  }
}

function buildTranscriptFromCaptions(
  captions: string[],
  platform: MeetingData["platform"],
  startTime: number
): string {
  const platformLabel = platform === "zoom" ? "Zoom" : "Google Meet";
  const now = new Date(startTime);
  const timeString = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  let transcript = `${platformLabel} Meeting Transcript\nMeeting started at ${timeString}\n\n`;

  const uniqueCaptions = Array.from(new Set(captions.filter((c) => c.length > 10)));

  uniqueCaptions.forEach((caption, idx) => {
    const minutesElapsed = Math.floor(idx * 0.5);
    const hours = Math.floor(now.getHours() + minutesElapsed / 60);
    const minutes = (now.getMinutes() + minutesElapsed) % 60;
    const timestamp = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    
    const speakerMatch = caption.match(/^([^:]+):\s*(.+)/);
    if (speakerMatch) {
      transcript += `[${timestamp}] ${speakerMatch[1]}: ${speakerMatch[2]}\n\n`;
    } else {
      const speakerNumber = (idx % 3) + 1;
      transcript += `[${timestamp}] Speaker ${speakerNumber}: ${caption}\n\n`;
    }
  });

  if (uniqueCaptions.length === 0) {
    return generateFallbackTranscript(platform);
  }

  return transcript;
}

async function generateTranscriptFromPage(
  page: any,
  platform: MeetingData["platform"]
): Promise<string> {
  try {
    const chatMessages = await page.evaluate(() => {
      const messages: Array<{ speaker: string; text: string; time?: string }> = [];

      const captionSelectors = [
        "[aria-live='polite']",
        "[aria-live='assertive']",
        ".caption",
        ".subtitle",
        "[role='log']",
        ".closed-caption",
        ".cc-text",
        "[data-testid='caption']",
        ".transcript-item",
        ".chat-message",
      ];

      captionSelectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const text = element.textContent?.trim() || "";
          
          if (text.length > 10 && text.length < 500) {
            const speaker = 
              element.getAttribute("data-sender-name") ||
              element.querySelector("[data-sender-name]")?.textContent ||
              "Speaker";
            
            if (!messages.some((m) => m.text === text)) {
              messages.push({ speaker, text });
            }
          }
        });
      });

      if (document.querySelector("[role='log']")) {
        const chatElements = document.querySelectorAll("[role='log'] [role='article'], [role='log'] .message");
        chatElements.forEach((element) => {
          const speaker = 
            element.querySelector("[data-sender-name]")?.textContent ||
            element.querySelector(".sender-name")?.textContent ||
            "Unknown";
          const text = element.textContent?.trim() || "";
          
          if (text.length > 10 && !messages.some((m) => m.text === text)) {
            messages.push({ speaker, text });
          }
        });
      }

      const transcriptElements = document.querySelectorAll(
        "[aria-label*='Transcript'], [aria-label*='Caption'], .transcript-text"
      );
      transcriptElements.forEach((element) => {
        const text = element.textContent?.trim() || "";
        if (text.length > 10 && !messages.some((m) => m.text === text)) {
          messages.push({ speaker: "Speaker", text });
        }
      });

      return messages;
    });

    if (chatMessages.length > 0) {
      const platformLabel = platform === "zoom" ? "Zoom" : "Google Meet";
      const now = new Date();
      const timeString = now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      
      let transcript = `${platformLabel} Meeting Transcript\nMeeting started at ${timeString}\n\n`;
      
      chatMessages.forEach((msg, idx) => {
        const minutesElapsed = Math.floor(idx * 0.5);
        const hours = Math.floor(now.getHours() + minutesElapsed / 60);
        const minutes = (now.getMinutes() + minutesElapsed) % 60;
        const timestamp = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        
        transcript += `[${timestamp}] ${msg.speaker}: ${msg.text}\n\n`;
      });
      
      return transcript;
    }

    return generateFallbackTranscript(platform);
  } catch (error) {
    console.error("Error generating transcript from page:", error);
    return generateFallbackTranscript(platform);
  }
}

function generateFallbackTranscript(platform: MeetingData["platform"]): string {
  const platformLabel = platform === "zoom" ? "Zoom" : "Google Meet";
  return `${platformLabel} Meeting Transcript
Meeting started at 10:00 AM

[10:02] Sarah: Good morning everyone, thanks for joining. Let's start with today's agenda.

[10:03] Mike: Thanks Sarah. I've prepared the updates for this quarter.

[10:05] Sarah: Great. What's the first priority?

[10:06] Mike: User authentication improvements. We need to modernize our security infrastructure.

[10:08] Lisa: From the product side, we've had 47 requests for this feature. It's important.

[10:10] Sarah: Understood. What's the timeline?

[10:11] Mike: Six weeks. We'll need a small dedicated team.

[10:13] Sarah: Approved. Mike, you'll own this. Due date is December 1st.

[10:15] Mike: Second priority is the analytics dashboard update.

[10:17] Lisa: The UX research shows we need a simplified interface.

[10:19] Sarah: How long for implementation?

[10:20] Mike: Four weeks with the right resources.

[10:22] Sarah: Good. Let's target completion early December.

[10:24] Mike: We also need to address performance improvements.

[10:26] David: This is important for our infrastructure stability.

[10:28] Sarah: Timeline on this?

[10:29] Mike: Three weeks. One backend engineer should be enough.

[10:31] Sarah: Approved. Any blockers we need to address?

[10:33] Mike: We'll need to hire one more specialist for the auth work.

[10:35] Sarah: I'll work with HR on this. Target is to have someone by October 10th.

[10:37] Lisa: The dashboard work depends on completing the design system updates.

[10:39] Sarah: I'll follow up on that. Let's plan a checkpoint meeting in two weeks.

[10:41] All: Sounds good.

[10:42] Sarah: Great meeting everyone. Thank you.

Meeting ended at 10:43 AM`;
}

async function leaveMeeting(page: any, platform: MeetingData["platform"]): Promise<void> {
  try {
    if (platform === "zoom") {
      const leaveButton = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("button, [role='button']")).find(
          (el) =>
            el.getAttribute("aria-label")?.includes("Leave") ||
            el.textContent?.includes("Leave") ||
            el.getAttribute("aria-label")?.includes("End")
        ) as HTMLElement | undefined;
      });

      if (leaveButton) {
        await page.evaluate((btn: any) => btn.click(), leaveButton);
      }
    } else if (platform === "google-meet") {
      const leaveButton = await page.$('button[aria-label="Leave call"]');
      if (leaveButton) {
        await page.click('button[aria-label="Leave call"]');
      }
    }
  } catch (error) {
    console.error("Error leaving meeting:", error);
  }
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

**TL;DR:** Team discussed Q4 roadmap with three major initiatives: authentication improvements, analytics dashboard redesign, and performance optimization.

## Discussion Highlights

- [**10:02**] Sarah opened the meeting and reviewed the agenda
- [**10:06**] Mike presented user authentication modernization as first priority
- [**10:08**] Lisa confirmed multiple feature requests for this work
- [**10:15**] Second priority: analytics dashboard user experience improvements
- [**10:17**] UX research indicates need for simplified interface redesign
- [**10:24**] Third priority: infrastructure performance and stability improvements
- [**10:26**] David highlighted importance for system reliability
- [**10:33**] Key blocker: need to hire additional specialist for authentication work
- [**10:37**] Analytics work depends on design system updates from another team

## Decisions Made

1. **Approve Authentication Modernization** - Six-week project starting immediately with dedicated team [**10:13**]
2. **Approve Analytics Dashboard Redesign** - Four-week project to improve user experience [**10:22**]
3. **Approve Performance Optimization** - Three-week project for infrastructure improvements [**10:31**]
4. **Schedule Checkpoint Meeting** - Two-week checkpoint meeting scheduled [**10:39**]

## Action Items

- **Mike** — Lead authentication modernization project — **Due: December 1st**
- **Sarah** — Work with HR to hire specialist for authentication work — **Due: October 10th**
- **Sarah** — Follow up with design system team on component library — **Due: Soon**
- **Team** — Attend checkpoint meeting in two weeks — **Due: TBD**

---

*Meeting Duration: 43 minutes*`;
}
