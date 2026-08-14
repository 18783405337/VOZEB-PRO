/**
 * Timeline editor types for drama storyboard
 */

export type TimelineZoomLevel = {
  pixelsPerSecond: number;
  label: string;
  majorInterval: number; // seconds between major ticks
  minorInterval: number; // seconds between minor ticks
};

export const TIMELINE_ZOOM_LEVELS: TimelineZoomLevel[] = [
  { pixelsPerSecond: 10, label: "10%", majorInterval: 10, minorInterval: 2 },
  { pixelsPerSecond: 20, label: "20%", majorInterval: 5, minorInterval: 1 },
  { pixelsPerSecond: 40, label: "40%", majorInterval: 5, minorInterval: 1 },
  { pixelsPerSecond: 60, label: "60%", majorInterval: 2, minorInterval: 0.5 },
  { pixelsPerSecond: 80, label: "80%", majorInterval: 2, minorInterval: 0.5 },
  { pixelsPerSecond: 100, label: "100%", majorInterval: 1, minorInterval: 0.2 },
  { pixelsPerSecond: 150, label: "150%", majorInterval: 1, minorInterval: 0.2 },
  { pixelsPerSecond: 200, label: "200%", majorInterval: 1, minorInterval: 0.1 },
];

export type TimelineTrackType = "video" | "audio" | "subtitle" | "marker";

export type TimelineMarker = {
  id: string;
  time: number;
  label: string;
  type: "scene" | "transition" | "keyframe";
  color?: string;
};

export type TimelineSelection = {
  shotIds: string[];
  startTime?: number;
  endTime?: number;
};

export type TimelineDragState = {
  type: "move" | "resize-start" | "resize-end" | "playhead" | "select";
  shotId?: string;
  startX: number;
  startTime: number;
  originalDuration?: number;
  originalOrder?: number;
};

export type TimelineExportFormat = "video" | "audio" | "pdf" | "json";

export type TimelinePlaybackState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loop: boolean;
  playbackRate: 1 | 1.5 | 2;
};
