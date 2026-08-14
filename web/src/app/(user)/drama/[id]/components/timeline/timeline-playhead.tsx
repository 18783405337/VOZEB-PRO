"use client";

import { formatTime } from "./timeline-utils";

type TimelinePlayheadProps = {
  currentTime: number;
  pixelsPerSecond: number;
  height: number;
  onSeek?: (time: number) => void;
};

export function TimelinePlayhead({
  currentTime,
  pixelsPerSecond,
  height,
  onSeek,
}: TimelinePlayheadProps) {
  const left = currentTime * pixelsPerSecond;

  return (
    <div
      className="absolute top-0 z-20 flex flex-col items-center"
      style={{ left, height }}
    >
      {/* Playhead marker */}
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 shadow-md">
        <div className="h-2 w-2 rounded-full bg-white" />
      </div>

      {/* Playhead line */}
      <div className="w-px flex-1 bg-red-500" />

      {/* Time label */}
      <div className="absolute -top-6 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
        {formatTime(currentTime)}
      </div>
    </div>
  );
}
