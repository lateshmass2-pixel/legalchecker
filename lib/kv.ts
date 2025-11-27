import { createClient } from "@vercel/kv";

export type MeetingStatus =
  | "waiting"
  | "connecting"
  | "transcribing"
  | "processing"
  | "done"
  | "error";

export interface MeetingData {
  id: string;
  meetingLink: string;
  platform: "zoom" | "google-meet";
  meetingId: string;
  status: MeetingStatus;
  createdAt: number;
  updatedAt: number;
  notes?: string;
  error?: string;
}

interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
}

class MemoryStore implements StorageAdapter {
  private store = new Map<string, { value: unknown; expiresAt?: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: unknown, options?: { ex?: number }) {
    const expiresAt = options?.ex
      ? Date.now() + options.ex * 1000
      : undefined;

    this.store.set(key, { value, expiresAt });
  }
}

const ttlSeconds = 60 * 60 * 24 * 7; // 7 days

function createKVClient(): StorageAdapter {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (url && token) {
    return createClient({ url, token });
  }

  return new MemoryStore();
}

const client = createKVClient();

export const kv = {
  async get<T = MeetingData>(key: string) {
    return client.get<T>(key);
  },
  async set(key: string, value: unknown) {
    return client.set(key, value, { ex: ttlSeconds });
  },
};
