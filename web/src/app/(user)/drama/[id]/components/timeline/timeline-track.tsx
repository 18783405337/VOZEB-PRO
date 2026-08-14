"use client";

import { useMemo } from "react";
import type { DramaShot } from "../../types";
import { calculateShotStartTimes, generateSceneColors } from "./timeline-utils";
import { TimelineShotBlock } from "./timeline-shot-block";

type TimelineTrackProps = {
  shots: DramaShot[];
  sceneIds: string[];
  pixelsPerSecond: number;
  selectedShotIds: string[];
  onSelectShot: (shotId: string, addToSelection: boolean) => void;
  onDoubleClickShot: (shotId: string) => void;
  onDragStart: (shotId: string, type: "move" | "resize-start" | "resize-end", startX: number) => void;
  trackType?: "video" | "audio";
};

export function TimelineTrack({
  shots,
  sceneIds,
  pixelsPerSecond,
  selectedShotIds,
  onSelectShot,
  onDoubleClickShot,
  onDragStart,
  trackType = "video",
}: TimelineTrackProps) {
  const startTimes = useMemo(() => calculateShotStartTimes(shots), [shots]);
  const sceneColors = useMemo(() => generateSceneColors(sceneIds), [sceneIds]);

  const sortedShots = useMemo(() => {
    return [...shots].sort((a, b) => a.order - b.order);
  }, [shots]);

  const getShotColor = (shot: DramaShot): string => {
    // Priority: generation status > storyboard status > scene color
    if (shot.generationStatus === "success" && shot.videoUrl) {
      return "#10b981"; // green-500
    }
    if (shot.generationStatus === "error") {
      return "#ef4444"; // red-500
    }
    if (shot.generationStatus === "running" || shot.generationStatus === "queued") {
      return "#f59e0b"; // amber-500
    }
    if (shot.storyboardStatus === "success" && shot.storyboardImageUrl) {
      return "#3b82f6"; // blue-500
    }
    if (shot.storyboardStatus === "error") {
      return "#f43f5e"; // rose-500
    }

    // Use scene color if available
    if (shot.sceneId) {
      return sceneColors.get(shot.sceneId) || "#6b7280"; // gray-500
    }

    return "#6b7280"; // gray-500
  };

  return (
    <div className="relative min-h-[60px] border-b border-border/50 bg-background/50">
      {/* Track label */}
      <div className="absolute left-0 top-0 z-10 flex h-full w-20 items-center border-r border-border/50 bg-muted/40 px-2">
        <span className="text-xs font-medium text-muted-foreground">
          {trackType === "video" ? "视频" : "音频"}
        </span>
      </div>

      {/* Track content area */}
      <div className="relative ml-20 h-full min-h-[60px]">
        {sortedShots.map((shot) => {
          const startTime = startTimes.get(shot.id) || 0;
          const color = getShotColor(shot);
          const isSelected = selectedShotIds.includes(shot.id);

          return (
            <TimelineShotBlock
              key={shot.id}
              shot={shot}
              startTime={startTime}
              pixelsPerSecond={pixelsPerSecond}
              color={color}
              isSelected={isSelected}
              onSelect={onSelectShot}
              onDoubleClick={onDoubleClickShot}
              onDragStart={onDragStart}
            />
          );
        })}
      </div>
    </div>
  );
}
