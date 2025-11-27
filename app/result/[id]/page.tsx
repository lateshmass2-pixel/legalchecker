"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Download,
  Share2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { MeetingData } from "@/lib/kv";

const recordingStatusOrder: MeetingData["recording"]["status"][] = [
  "idle",
  "starting",
  "recording",
  "processing",
  "available",
];

type AutomationStep = {
  status: MeetingData["recording"]["status"];
  title: string;
  description: string;
};

const buildAutomationSteps = (name: string): AutomationStep[] => [
  {
    status: "starting",
    title: `Joining as ${name}`,
    description: "Bot enters the call muted using your chosen display name.",
  },
  {
    status: "recording",
    title: "Recording + transcribing live",
    description: "Audio is captured so you can stay focused elsewhere.",
  },
  {
    status: "processing",
    title: "Generating clean notes",
    description: "We polish the transcript into structured notes.",
  },
  {
    status: "available",
    title: "Saved for later",
    description: "Recording + notes stay available for 7 days.",
  },
];

const getRecordingStatusLabel = (
  status: MeetingData["recording"]["status"]
) => {
  switch (status) {
    case "starting":
      return "Joining";
    case "recording":
      return "Recording";
    case "processing":
      return "Processing";
    case "available":
      return "Saved";
    default:
      return "Waiting";
  }
};

const formatTime = (timestamp?: number) => {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

const formatDuration = (minutes?: number) => {
  if (!minutes) return "—";
  if (minutes < 1) return "< 1 min";
  return `${minutes} min`;
};

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesCopied, setNotesCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/transcribe?id=${id}`);
        if (!response.ok) {
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        const result = await response.json();
        if (!isMounted) return;

        setData(result);
        setLoading(false);

        if (result.status === "done" || result.status === "error") {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch (error) {
        console.error("Error fetching status:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 2000);

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [id]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "waiting":
        return {
          label: "Waiting for meeting to start",
          color: "text-yellow-400",
          icon: Loader2,
        };
      case "connecting":
        return {
          label: "Connecting to meeting",
          color: "text-blue-400",
          icon: Loader2,
        };
      case "transcribing":
        return {
          label: "Transcribing audio",
          color: "text-blue-400",
          icon: Loader2,
        };
      case "processing":
        return {
          label: "Generating notes",
          color: "text-blue-400",
          icon: Loader2,
        };
      case "done":
        return {
          label: "Notes ready",
          color: "text-green-400",
          icon: CheckCircle2,
        };
      case "error":
        return {
          label: "Error occurred",
          color: "text-red-400",
          icon: AlertCircle,
        };
      default:
        return {
          label: "Processing",
          color: "text-gray-400",
          icon: Loader2,
        };
    }
  };

  const recording: MeetingData["recording"] = data?.recording ?? {
    status: "idle",
  };

  const handleCopy = async () => {
    if (!data?.notes) return;
    await navigator.clipboard.writeText(data.notes);
    setNotesCopied(true);
    setTimeout(() => setNotesCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!data?.notes) return;
    const blob = new Blob([data.notes], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-notes-${id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/result/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Meeting Notes",
          text: "Check out these meeting notes",
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleRecordingDownload = () => {
    if (!data) return;
    const started = recording.startedAt
      ? new Date(recording.startedAt).toISOString()
      : "unknown";
    const ended = recording.endedAt
      ? new Date(recording.endedAt).toISOString()
      : "still-recording";

    const summary = `Meeting ID: ${data.id}
Joined as: ${data.displayName}
Platform: ${data.platform}
Recording status: ${recording.status}
Recording started: ${started}
Recording ended: ${ended}
Duration: ${recording.durationMinutes ?? "n/a"} minutes

This file is a placeholder summary representing the recorded audio for demo purposes.`;

    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-recording-${id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!data && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0a]">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-semibold text-white">Meeting not found</h2>
          <Button onClick={() => router.push("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = data ? getStatusInfo(data.status) : null;
  const StatusIcon = statusInfo?.icon || Loader2;
  const recordingStatusLabel = getRecordingStatusLabel(recording.status);
  const platformLabel = data
    ? data.platform === "zoom"
      ? "Zoom"
      : "Google Meet"
    : "";
  const automationSteps = buildAutomationSteps(data?.displayName || "you");
  const recordingIndex = recordingStatusOrder.indexOf(recording.status);
  const currentRecordingIndex = recordingIndex === -1 ? 0 : recordingIndex;

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="text-[#888] hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            New Meeting
          </Button>

          {data?.status === "done" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleCopy}>
                {notesCopied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                {shareCopied ? "Copied!" : "Share"}
              </Button>
            </div>
          )}
        </div>

        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-[#111] border border-[#222] rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-widest text-[#666]">
                  Live automation
                </p>
                <span className="text-sm text-[#aaa]">
                  {recordingStatusLabel}
                </span>
              </div>
              <div className="space-y-4">
                {automationSteps.map((step) => {
                  const stepIndex = recordingStatusOrder.indexOf(step.status);
                  const isComplete = stepIndex < currentRecordingIndex;
                  const isActive = stepIndex === currentRecordingIndex;

                  return (
                    <div
                      key={step.status}
                      className="flex items-start gap-3 rounded-lg border border-[#222] bg-[#0f0f0f] p-3"
                    >
                      <div className="mt-1">
                        {isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 text-[#0066ff] animate-spin" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-[#333]" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">
                          {step.title}
                        </p>
                        <p className="text-xs text-[#777]">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-lg p-5 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#666]">
                  Recording summary
                </p>
                <p className="text-lg font-semibold text-white">
                  Hands-free capture
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm text-[#ccc]">
                <div>
                  <dt className="text-[#777]">Joined as</dt>
                  <dd className="text-white font-medium">
                    {data.displayName}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#777]">Platform</dt>
                  <dd>{platformLabel}</dd>
                </div>
                <div>
                  <dt className="text-[#777]">Recording</dt>
                  <dd>
                    {recording.status === "available"
                      ? `Saved (${formatDuration(recording.durationMinutes)})`
                      : `${recordingStatusLabel}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#777]">Window</dt>
                  <dd>
                    {recording.startedAt && recording.endedAt
                      ? `${formatTime(recording.startedAt)} → ${formatTime(
                          recording.endedAt
                        )}`
                      : recording.startedAt
                      ? `${formatTime(recording.startedAt)} → live`
                      : "—"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[#777]">Meeting link</dt>
                  <dd>
                    <a
                      href={data.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0066ff] hover:underline break-all"
                    >
                      {data.meetingLink}
                    </a>
                  </dd>
                </div>
              </dl>
              <Button
                variant="outline"
                onClick={handleRecordingDownload}
                disabled={recording.status !== "available"}
                className="w-full"
              >
                {recording.status === "available"
                  ? "Download recording summary"
                  : "Recording in progress"}
              </Button>
              <p className="text-xs text-[#555]">
                Recordings and notes are automatically deleted after 7 days.
              </p>
            </div>
          </div>
        )}

        <div className="bg-[#111] border border-[#222] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-white">Meeting Notes</h1>
            {statusInfo && (
              <Badge className="flex items-center gap-2">
                <StatusIcon
                  className={`w-4 h-4 ${statusInfo.color} ${
                    data?.status !== "done" && data?.status !== "error"
                      ? "animate-spin"
                      : ""
                  }`}
                />
                <span className={statusInfo.color}>{statusInfo.label}</span>
              </Badge>
            )}
          </div>

          {data?.statusMessage && (
            <p className="text-sm text-[#888] mb-4">{data.statusMessage}</p>
          )}

          {data?.status === "done" && data.notes ? (
            <div className="space-y-4 text-[#ccc] leading-relaxed">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-3xl font-bold text-white mb-4 mt-6">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-semibold text-white mb-3 mt-6">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-semibold text-white mb-2 mt-4">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-[#ccc] mb-4 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-none space-y-2 mb-4">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-2 mb-4 text-[#ccc]">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-[#ccc] leading-relaxed">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-white font-semibold">
                      {children}
                    </strong>
                  ),
                  hr: () => <hr className="border-[#222] my-6" />,
                  code: ({ children }) => (
                    <code className="bg-[#1a1a1a] text-[#0066ff] px-1.5 py-0.5 rounded text-sm">
                      {children}
                    </code>
                  ),
                }}
              >
                {data.notes}
              </ReactMarkdown>
            </div>
          ) : data?.status === "error" ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-400">
                {data.error || "An error occurred while processing the meeting"}
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-[#0066ff] animate-spin mx-auto mb-4" />
              <p className="text-[#888]">
                {statusInfo?.label || "Processing your meeting..."}
              </p>
              <p className="text-[#555] text-sm mt-2">
                This usually takes 30-60 seconds
              </p>
            </div>
          )}
        </div>

        {data?.status === "done" && (
          <div className="text-center text-xs text-[#555]">
            <p>
              These notes will be available for 7 days •{" "}
              <button
                onClick={handleShare}
                className="text-[#0066ff] hover:underline"
              >
                Share this link
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
