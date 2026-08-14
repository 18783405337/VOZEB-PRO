"use client";

import { useMemo } from "react";
import type { TimelineMarker } from "./timeline-types";

type TimelineMarkersProps = {
  markers: TimelineMarker[];
  pixelsPerSecond: number;
  height: number;
  onMarkerClick?: (markerId: string) => void;
};

export function TimelineMarkers({
  markers,
  pixelsPerSecond,
  height,
  onMarkerClick,
}: TimelineMarkersProps) {
  const markerColors = useMemo(() => ({
    scene: "#8b5cf6", // violet
    transition: "#f59e0b", // amber
    keyframe: "#06b6d4", // cyan
  }), []);

  return (
    <div className="pointer-events-none absolute inset-0">
      {markers.map((marker) => {
        const left = marker.time * pixelsPerSecond;
        const color = marker.color || markerColors[marker.type];

        return (
          <div
            key={marker.id}
            className="pointer-events-auto absolute top-0 cursor-pointer"
            style={{ left, height }}
            onClick={() => onMarkerClick?.(marker.id)}
          >
            {/* Marker line */}
            <div
              className="w-0.5 h-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ backgroundColor: color }}
            />

            {/* Marker flag */}
            <div
              className="absolute top-0 left-0 transform -translate-x-1/2"
              style={{ backgroundColor: color }}
            >
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent"
                style={{ borderTopColor: color }}
              />
            </div>

            {/* Marker label */}
            <div
              className="absolute top-2 left-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {marker.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
