"use client";

import { useMemo } from "react";
import type { DramaShot } from "../../types";
import { formatTime } from "./timeline-utils";

type TimelineShotBlockProps = {
  shot: DramaShot;
  startTime: number;
  pixelsPerSecond: number;
  color: string;
  isSelected: boolean;
  onSelect: (shotId: string, addToSelection: boolean) => void;
  onDoubleClick: (shotId: string) => void;
  onDragStart: (shotId: string, type: "move" | "resize-start" | "resize-end", startX: number) => void;
};

export function TimelineShotBlock({
  shot,
  startTime,
  pixelsPerSecond,
  color,
  isSelected,
  onSelect,
  onDoubleClick,
  onDragStart,
}: TimelineShotBlockProps) {
  const left = startTime * pixelsPerSecond;
  const width = shot.duration * pixelsPerSecond;

  const statusIcon = useMemo(() => {
    if (shot.generationStatus === "success" && shot.videoUrl) return "✓";
    if (shot.generationStatus === "running" || shot.generationStatus === "queued") return "⋯";
    if (shot.generationStatus === "error") return "✕";
    if (shot.storyboardStatus === "success" && shot.storyboardImageUrl) return "○";
    return "";
  }, [shot]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Check if clicking on resize handles (8px from edges)
    if (x < 8) {
      onDragStart(shot.id, "resize-start", e.clientX);
    } else if (x > width - 8) {
      onDragStart(shot.id, "resize-end", e.clientX);
    } else {
      onDragStart(shot.id, "move", e.clientX);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(shot.id, e.ctrlKey || e.metaKey || e.shiftKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick(shot.id);
  };

  return (
    <div
      className={`absolute top-0 h-full cursor-move rounded border-2 transition-all ${
        isSelected ? "border-white shadow-lg ring-2 ring-blue-400" : "border-transparent hover:border-white/30"
      }`}
      style={{
        left,
        width: Math.max(width, 20),
        backgroundColor: color,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Resize handle - left */}
      <div className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/20 opacity-0 transition-opacity hover:opacity-100" />

      {/* Content */}
      <div className="flex h-full flex-col justify-center overflow-hidden px-2">
        <div className="flex items-center gap-1">
          {statusIcon && (
            <span className="text-xs font-bold text-white">{statusIcon}</span>
          )}
          <span className="truncate text-xs font-medium text-white">
            #{shot.order} {shot.title}
          </span>
        </div>
        {width > 60 && (
          <span className="text-[10px] text-white/80">{formatTime(shot.duration)}</span>
        )}
      </div>

      {/* Resize handle - right */}
      <div className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/20 opacity-0 transition-opacity hover:opacity-100" />

      {/* Thumbnail preview on hover */}
      {(shot.storyboardImageUrl || shot.videoUrl) && width > 40 && (
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity hover:opacity-100">
          <img
            src={shot.storyboardImageUrl || shot.videoUrl}
            alt={shot.title}
            className="h-full w-full object-cover opacity-20"
          />
        </div>
      )}
    </div>
  );
}
