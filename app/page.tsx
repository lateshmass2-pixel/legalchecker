"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Video } from "lucide-react";
import { parseMeetingLink } from "@/lib/utils";

export default function HomePage() {
  const [meetingLink, setMeetingLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0a0a0a]">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Video className="w-8 h-8 text-[#0066ff]" />
            <h1 className="text-4xl font-bold text-white">MeetingToNotes</h1>
          </div>
          <p className="text-[#888] text-lg">
            Paste any Zoom or Google Meet link. Get clean meeting notes instantly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>

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
                Generate Notes
              </span>
            )}
          </Button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8">
          {[
            { title: "No Login", desc: "Just paste and go" },
            { title: "Live Status", desc: "Watch it transcribe" },
            { title: "Share & Export", desc: "Copy or download .md" },
          ].map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-lg border border-[#222] bg-[#111] text-center"
            >
              <h3 className="font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-[#888]">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-[#555] pt-4">
          Notes are stored for 7 days • No data is sold or shared
        </div>
      </div>
    </div>
  );
}
