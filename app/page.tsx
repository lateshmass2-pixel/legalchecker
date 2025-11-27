"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Sparkles, Video } from "lucide-react";
import { parseMeetingLink } from "@/lib/utils";

export default function HomePage() {
  const [meetingLink, setMeetingLink] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("Please enter the name you'd like us to join with");
      return;
    }

    if (!meetingLink.trim()) {
      setError("Please enter a meeting link");
      return;
    }

    const { platform, meetingId } = parseMeetingLink(meetingLink);

    if (!platform) {
      setError("Invalid meeting link. Please use a Zoom or Google Meet link.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingLink: meetingLink.trim(),
          platform,
          meetingId,
          displayName: displayName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process meeting");
      }

      router.push(`/result/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  const features = [
    { title: "Join-as-you bot", desc: "AI attends using your display name" },
    { title: "Hands-free recording", desc: "Audio captured while you focus" },
    { title: "Live status", desc: "Watch it transcribe in real-time" },
    { title: "Share & export", desc: "Copy or download structured .md" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0a0a0a]">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Video className="w-8 h-8 text-[#0066ff]" />
            <h1 className="text-4xl font-bold text-white">MeetingToNotes</h1>
          </div>
          <p className="text-[#888] text-lg">
            Paste your Zoom or Google Meet link, pick the name we join with,
            and let the AI attend, record, and summarize while you keep working.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#aaa]">
              We'll join the call as
            </label>
            <Input
              placeholder="e.g., Sarah Chen"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-[#555]">
              Your mic and camera stay off. We just borrow this name so teammates
              know it's you.
            </p>
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="Paste your Zoom or Google Meet link here...

Examples:
• https://zoom.us/j/123456789
• https://meet.google.com/abc-defg-hij"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              className="min-h-[140px] text-base resize-none"
              disabled={isLoading}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Send the AI
              </span>
            )}
          </Button>
        </form>

        <div className="flex items-start gap-3 rounded-lg border border-[#222] bg-[#0f0f0f] p-4 text-sm text-[#aaa]">
          <ShieldCheck className="w-5 h-5 text-[#0066ff] mt-0.5" />
          <p>
            We quietly join the meeting with your name, record the conversation
            live, and drop polished notes plus the recording link back here when
            it's ready.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {features.map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-lg border border-[#222] bg-[#111] text-center"
            >
              <h3 className="font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-[#888]">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-[#555] pt-2">
          Notes and recordings are stored for 7 days • No data is sold or shared
        </div>
      </div>
    </div>
  );
}
