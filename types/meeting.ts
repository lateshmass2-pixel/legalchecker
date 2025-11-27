export type MeetingPlatform = "zoom" | "google-meet";

export type MeetingStatus =
  | "waiting"
  | "connecting"
  | "listening"
  | "transcribing"
  | "processing"
  | "done"
  | "error";

export interface MeetingActionItem {
  owner: string;
  task: string;
  due: string;
}

export interface MeetingDecision {
  title: string;
  description: string;
  decidedAt: string;
}

export interface MeetingTimelineEntry {
  timestamp: string;
  text: string;
}

export interface MeetingNotes {
  tldr: string;
  discussion: MeetingTimelineEntry[];
  decisions: MeetingDecision[];
  actionItems: MeetingActionItem[];
  markdown: string;
}

export interface MeetingJob {
  id: string;
  meetingLink: string;
  platform: MeetingPlatform;
  meetingId: string;
  status: MeetingStatus;
  createdAt: number;
  updatedAt: number;
  notes?: MeetingNotes;
  error?: string;
}

export interface MeetingStatusSegment {
  status: MeetingStatus;
  label: string;
  durationMs?: number;
}
