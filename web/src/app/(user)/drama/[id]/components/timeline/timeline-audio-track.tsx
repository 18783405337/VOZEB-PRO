"use client";

import { useMemo } from "react";
import type { DramaShot } from "../../types";
import { calculateShotStartTimes } from "./timeline-utils";

type TimelineAudioTrackProps = {
  shots: DramaShot[];
  pixelsPerSecond: number;
};

export function TimelineAudioTrack({
  shots,
  pixelsPerSecond,
}: TimelineAudioTrackProps) {
  const startTimes = useMemo(() => calculateShotStartTimes(shots), [shots]);

  const sortedShots = useMemo(() => {
    return [...shots].sort((a, b) => a.order - b.order);
  }, [shots]);

  const getAudioColor = (shot: DramaShot): string => {
    if (shot.audioStatus === "success" && shot.audioUrl) {
      return "#10b981"; // green-500
    }
    if (shot.audioStatus === "error") {
      return "#ef4444"; // red-500
    }
    if (shot.audioStatus === "running" || shot.audioStatus === "queued") {
      return "#f59e0b"; // amber-500
    }
    if (shot.audioMode === "mute") {
      return "#6b7280"; // gray-500
    }
    return "#3b82f6"; // blue-500
  };

  const getAudioLabel = (shot: DramaShot): string => {
    if (shot.audioMode === "mute") return "静音";
    if (shot.audioMode === "voiceover") return "配音";
    if (shot.audioMode === "source") return "原音";
    return "";
  };

  return (
    <div className="relative min-h-[48px] border-b border-border/50 bg-background/50">
      {/* Track label */}
      <div className="absolute left-0 top-0 z-10 flex h-full w-20 items-center border-r border-border/50 bg-muted/40 px-2">
        <span className="text-xs font-medium text-muted-foreground">音频</span>
      </div>

      {/* Track content area */}
      <div className="relative ml-20 h-full min-h-[48px]">
        {sortedShots.map((shot) => {
          const startTime = startTimes.get(shot.id) || 0;
          const left = startTime * pixelsPerSecond;
          const width = shot.duration * pixelsPerSecond;
          const color = getAudioColor(shot);
          const label = getAudioLabel(shot);

          // Only render if shot has audio content
          if (!shot.dialogue && !shot.narration && shot.audioMode !== "source") {
            return null;
          }

          return (
            <div
              key={shot.id}
              className="absolute top-1 h-10 rounded border border-white/20"
              style={{
                left,
                width: Math.max(width, 20),
                backgroundColor: color,
              }}
            >
              <div className="flex h-full items-center justify-center overflow-hidden px-2">
                <span className="truncate text-xs font-medium text-white">
                  {label}
                </span>
              </div>

              {/* Audio waveform visualization (placeholder) */}
              {shot.audioUrl && (
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <div className="flex h-6 items-end gap-px">
                    {Array.from({ length: Math.floor(width / 4) }).map((_, i) => (
                      <div
                        key={i}
                        className="w-0.5 bg-white"
                        style={{
                          height: `${20 + Math.random() * 80}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
