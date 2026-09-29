// src/types/aiContent.ts

export type DayPost = {
  day: number | string;
  hook: string;
  caption: string;
  hashtags: string[];
  post_type: "carousel" | "reel" | "story" | "static";
  best_time: string;
  cta: string;
  visual_prompt: string;
  script?: string;
  slides?: string[];
  platform?: string;
};

export interface PostVariations {
  viral: DayPost;
  reach: DayPost;
  niche: DayPost;
  platformPosts?: {
    instagram: DayPost;
    reels: DayPost;
    facebook: DayPost;
    linkedin: DayPost;
  };
}

export interface CalendarResponse {
  calendarId: string;
  calendar: DayPost[];
  message: string;
}
