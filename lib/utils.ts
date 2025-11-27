import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseMeetingLink(link: string): { platform: 'zoom' | 'google-meet' | null, meetingId: string } {
  const cleaned = link.trim();
  
  // Zoom patterns
  const zoomPatterns = [
    /zoom\.us\/j\/(\d+)/,
    /zoom\.us\/meeting\/(\d+)/,
    /zoom\.com\/j\/(\d+)/,
  ];
  
  for (const pattern of zoomPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return { platform: 'zoom', meetingId: match[1] };
    }
  }
  
  // Google Meet patterns
  const meetPatterns = [
    /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/,
    /meet\.google\.com\/([a-z\-]+)/,
  ];
  
  for (const pattern of meetPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return { platform: 'google-meet', meetingId: match[1] };
    }
  }
  
  return { platform: null, meetingId: '' };
}
