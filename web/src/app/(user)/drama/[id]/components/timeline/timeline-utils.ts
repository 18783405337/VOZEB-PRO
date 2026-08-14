/**
 * Timeline utility functions
 */

import type { DramaShot } from "../../types";

/**
 * Format time in seconds to MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  if (minutes > 0) {
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs}.${ms.toString().padStart(2, "0")}s`;
}

/**
 * Calculate total duration from shots
 */
export function calculateTotalDuration(shots: DramaShot[]): number {
  return shots.reduce((total, shot) => total + shot.duration, 0);
}

/**
 * Calculate start time for each shot
 */
export function calculateShotStartTimes(shots: DramaShot[]): Map<string, number> {
  const startTimes = new Map<string, number>();
  let currentTime = 0;

  const sortedShots = [...shots].sort((a, b) => a.order - b.order);

  for (const shot of sortedShots) {
    startTimes.set(shot.id, currentTime);
    currentTime += shot.duration;
  }

  return startTimes;
}

/**
 * Find shot at a given time
 */
export function findShotAtTime(shots: DramaShot[], time: number): DramaShot | null {
  const startTimes = calculateShotStartTimes(shots);
  const sortedShots = [...shots].sort((a, b) => a.order - b.order);

  for (const shot of sortedShots) {
    const startTime = startTimes.get(shot.id) || 0;
    const endTime = startTime + shot.duration;

    if (time >= startTime && time < endTime) {
      return shot;
    }
  }

  return sortedShots[sortedShots.length - 1] || null;
}

/**
 * Snap time to grid based on interval
 */
export function snapToGrid(time: number, interval: number): number {
  return Math.round(time / interval) * interval;
}

/**
 * Convert pixel position to time
 */
export function pixelToTime(pixel: number, pixelsPerSecond: number, scrollLeft: number = 0): number {
  return Math.max(0, (pixel + scrollLeft) / pixelsPerSecond);
}

/**
 * Convert time to pixel position
 */
export function timeToPixel(time: number, pixelsPerSecond: number): number {
  return time * pixelsPerSecond;
}

/**
 * Get shot color based on status and scene
 */
export function getShotColor(shot: DramaShot, sceneColors: Map<string, string>): string {
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
}

/**
 * Generate distinct colors for scenes
 */
export function generateSceneColors(sceneIds: string[]): Map<string, string> {
  const colors = [
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#14b8a6", // teal-500
    "#f97316", // orange-500
    "#06b6d4", // cyan-500
    "#a855f7", // purple-500
    "#eab308", // yellow-500
    "#22c55e", // green-500
  ];

  const colorMap = new Map<string, string>();
  sceneIds.forEach((id, index) => {
    colorMap.set(id, colors[index % colors.length]);
  });

  return colorMap;
}

/**
 * Check if two shot ranges overlap
 */
export function doShotsOverlap(
  shot1Start: number,
  shot1Duration: number,
  shot2Start: number,
  shot2Duration: number
): boolean {
  const shot1End = shot1Start + shot1Duration;
  const shot2End = shot2Start + shot2Duration;

  return shot1Start < shot2End && shot2Start < shot1End;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
