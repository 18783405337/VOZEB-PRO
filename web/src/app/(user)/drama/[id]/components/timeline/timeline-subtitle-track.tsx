"use client";

import { useMemo } from "react";
import type { DramaShot } from "../../types";
import { calculateShotStartTimes } from "./timeline-utils";

type TimelineSubtitleTrackProps = {
  shots: DramaShot[];
  pixelsPerSecond: number;
};

export function TimelineSubtitleTrack({
  shots,
  pixelsPerSecond,
}: TimelineSubtitleTrackProps) {
  const startTimes = useMemo(() => calculateShotStartTimes(shots), [shots]);

  const sortedShots = useMemo(() => {
    return [...shots].sort((a, b) => a.order - b.order);
  }, [shots]);

  // Extract subtitle segments from shots
  const subtitleSegments = useMemo(() => {
    const segments: Array<{
      shotId: string;
      startTime: number;
      duration: number;
      text: string;
      type: "dialogue" | "narration";
    }> = [];

    sortedShots.forEach((shot) => {
      const startTime = startTimes.get(shot.id) || 0;

      if (shot.dialogue) {
        segments.push({
          shotId: shot.id,
          startTime,
          duration: shot.duration,
          text: shot.dialogue,
          type: "dialogue",
        });
      }

      if (shot.narration) {
        segments.push({
          shotId: shot.id,
          startTime,
          duration: shot.duration,
          text: shot.narration,
          type: "narration",
        });
      }
    });

    return segments;
  }, [sortedShots, startTimes]);

  if (subtitleSegments.length === 0) {
    return null;
  }

  return (
    <div className="relative min-h-[40px] border-b border-border/50 bg-background/50">
      {/* Track label */}
      <div className="absolute left-0 top-0 z-10 flex h-full w-20 items-center border-r border-border/50 bg-muted/40 px-2">
        <span className="text-xs font-medium text-muted-foreground">字幕</span>
      </div>

      {/* Track content area */}
      <div className="relative ml-20 h-full min-h-[40px]">
        {subtitleSegments.map((segment, index) => {
          const left = segment.startTime * pixelsPerSecond;
          const width = segment.duration * pixelsPerSecond;
          const color = segment.type === "dialogue" ? "#3b82f6" : "#8b5cf6"; // blue or violet

          return (
            <div
              key={`${segment.shotId}-${index}`}
              className="absolute top-1 h-8 rounded border border-white/20"
              style={{
                left,
                width: Math.max(width, 20),
                backgroundColor: color,
              }}
            >
              <div className="flex h-full items-center overflow-hidden px-2">
                <span className="truncate text-xs text-white">
                  {segment.text.substring(0, 50)}
                  {segment.text.length > 50 ? "..." : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
