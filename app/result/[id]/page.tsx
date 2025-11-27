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
            <div className="flex gap-2">
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
