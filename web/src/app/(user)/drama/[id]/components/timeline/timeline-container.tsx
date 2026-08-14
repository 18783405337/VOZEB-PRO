"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DramaShot, DramaScene } from "../../types";
import { calculateTotalDuration, calculateShotStartTimes, pixelToTime, snapToGrid } from "./timeline-utils";
import { TIMELINE_ZOOM_LEVELS, type TimelineDragState, type TimelineMarker } from "./timeline-types";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineTrack } from "./timeline-track";
import { TimelinePlayhead } from "./timeline-playhead";
import { TimelineControls } from "./timeline-controls";
import { TimelineAudioTrack } from "./timeline-audio-track";
import { TimelineSubtitleTrack } from "./timeline-subtitle-track";
import { TimelineMarkers } from "./timeline-markers";

type TimelineContainerProps = {
  shots: DramaShot[];
  scenes: DramaScene[];
  selectedShotIds: string[];
  onSelectShots: (shotIds: string[]) => void;
  onUpdateShot: (shotId: string, updates: Partial<DramaShot>) => void;
  onReorderShots: (shotId: string, newOrder: number) => void;
  onDoubleClickShot: (shotId: string) => void;
};

export function TimelineContainer({
  shots,
  scenes,
  selectedShotIds,
  onSelectShots,
  onUpdateShot,
  onReorderShots,
  onDoubleClickShot,
}: TimelineContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Zoom and scroll state
  const [zoomLevelIndex, setZoomLevelIndex] = useState(3); // Default to 60%
  const zoomLevel = TIMELINE_ZOOM_LEVELS[zoomLevelIndex];

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loop, setLoop] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  // Drag state
  const [dragState, setDragState] = useState<TimelineDragState | null>(null);

  // Calculate total duration
  const duration = useMemo(() => calculateTotalDuration(shots), [shots]);
  const startTimes = useMemo(() => calculateShotStartTimes(shots), [shots]);

  // Scene IDs for color generation
  const sceneIds = useMemo(() => [...new Set(scenes.map((s) => s.id))], [scenes]);

  // Timeline width
  const timelineWidth = Math.max(duration * zoomLevel.pixelsPerSecond, 1000);

  // Generate scene markers
  const sceneMarkers = useMemo(() => {
    const markers: TimelineMarker[] = [];
    let currentSceneId: string | undefined;

    const sortedShots = [...shots].sort((a, b) => a.order - b.order);

    sortedShots.forEach((shot) => {
      const startTime = startTimes.get(shot.id) || 0;

      if (shot.sceneId && shot.sceneId !== currentSceneId) {
        const scene = scenes.find((s) => s.id === shot.sceneId);
        if (scene) {
          markers.push({
            id: `scene-${shot.sceneId}-${shot.id}`,
            time: startTime,
            label: scene.name,
            type: "scene",
          });
          currentSceneId = shot.sceneId;
        }
      }
    });

    return markers;
  }, [shots, scenes, startTimes]);

  // Playback effect
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + (0.016 * playbackRate); // 60fps

        if (next >= duration) {
          if (loop) {
            return 0;
          } else {
            setIsPlaying(false);
            return duration;
          }
        }

        return next;
      });
    }, 16);

    return () => clearInterval(interval);
  }, [isPlaying, duration, loop, playbackRate]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevelIndex((prev) => Math.min(prev + 1, TIMELINE_ZOOM_LEVELS.length - 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevelIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Playback controls
  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleSkipBack = useCallback(() => {
    setCurrentTime((prev) => Math.max(0, prev - 5));
  }, []);

  const handleSkipForward = useCallback(() => {
    setCurrentTime((prev) => Math.min(duration, prev + 5));
  }, [duration]);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleToggleLoop = useCallback(() => {
    setLoop((prev) => !prev);
  }, []);

  const handleChangePlaybackRate = useCallback((rate: 1 | 1.5 | 2) => {
    setPlaybackRate(rate);
  }, []);

  // Shot selection
  const handleSelectShot = useCallback(
    (shotId: string, addToSelection: boolean) => {
      if (addToSelection) {
        if (selectedShotIds.includes(shotId)) {
          onSelectShots(selectedShotIds.filter((id) => id !== shotId));
        } else {
          onSelectShots([...selectedShotIds, shotId]);
        }
      } else {
        onSelectShots([shotId]);
      }
    },
    [selectedShotIds, onSelectShots]
  );

  // Drag handling
  const handleDragStart = useCallback(
    (shotId: string, type: "move" | "resize-start" | "resize-end", startX: number) => {
      const shot = shots.find((s) => s.id === shotId);
      if (!shot) return;

      const startTime = startTimes.get(shotId) || 0;

      setDragState({
        type,
        shotId,
        startX,
        startTime,
        originalDuration: shot.duration,
        originalOrder: shot.order,
      });
    },
    [shots, startTimes]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState || !containerRef.current) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / zoomLevel.pixelsPerSecond;

      if (dragState.type === "move") {
        // Calculate new start time
        const newStartTime = Math.max(0, dragState.startTime + deltaTime);
        const snappedTime = snapToGrid(newStartTime, zoomLevel.minorInterval);

        // Find which position this corresponds to
        const sortedShots = [...shots].sort((a, b) => a.order - b.order);
        let newOrder = 1;

        for (let i = 0; i < sortedShots.length; i++) {
          const shotStartTime = startTimes.get(sortedShots[i].id) || 0;
          if (snappedTime >= shotStartTime) {
            newOrder = sortedShots[i].order + 1;
          }
        }

        // Update order if changed
        if (newOrder !== dragState.originalOrder) {
          onReorderShots(dragState.shotId, newOrder);
        }
      } else if (dragState.type === "resize-end") {
        // Update duration
        const newDuration = Math.max(0.5, (dragState.originalDuration || 5) + deltaTime);
        const snappedDuration = snapToGrid(newDuration, zoomLevel.minorInterval);

        onUpdateShot(dragState.shotId, { duration: snappedDuration });
      } else if (dragState.type === "resize-start") {
        // Resize from start (more complex - affects both start time and duration)
        const newDuration = Math.max(0.5, (dragState.originalDuration || 5) - deltaTime);
        const snappedDuration = snapToGrid(newDuration, zoomLevel.minorInterval);

        onUpdateShot(dragState.shotId, { duration: snappedDuration });
      }
    },
    [dragState, zoomLevel, shots, startTimes, onUpdateShot, onReorderShots]
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  // Mouse event listeners
  useEffect(() => {
    if (dragState) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Click on timeline to seek
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragState) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
      const time = pixelToTime(x, zoomLevel.pixelsPerSecond, scrollLeft);

      setCurrentTime(Math.min(time, duration));
    },
    [dragState, zoomLevel, duration]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background">
      {/* Controls */}
      <TimelineControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        loop={loop}
        playbackRate={playbackRate}
        zoomLevel={zoomLevel}
        availableZoomLevels={TIMELINE_ZOOM_LEVELS}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onSkipBack={handleSkipBack}
        onSkipForward={handleSkipForward}
        onSeek={handleSeek}
        onToggleLoop={handleToggleLoop}
        onChangePlaybackRate={handleChangePlaybackRate}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />

      {/* Timeline area */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-x-auto overflow-y-auto"
        onClick={handleTimelineClick}
      >
        <div ref={containerRef} className="relative" style={{ width: timelineWidth }}>
          {/* Ruler */}
          <div className="sticky left-0 top-0 z-10">
            <TimelineRuler
              duration={duration}
              pixelsPerSecond={zoomLevel.pixelsPerSecond}
              majorInterval={zoomLevel.majorInterval}
              minorInterval={zoomLevel.minorInterval}
              width={timelineWidth}
            />
          </div>

          {/* Video track */}
          <TimelineTrack
            shots={shots}
            sceneIds={sceneIds}
            pixelsPerSecond={zoomLevel.pixelsPerSecond}
            selectedShotIds={selectedShotIds}
            onSelectShot={handleSelectShot}
            onDoubleClickShot={onDoubleClickShot}
            onDragStart={handleDragStart}
            trackType="video"
          />

          {/* Audio track */}
          <TimelineAudioTrack
            shots={shots}
            pixelsPerSecond={zoomLevel.pixelsPerSecond}
          />

          {/* Subtitle track */}
          <TimelineSubtitleTrack
            shots={shots}
            pixelsPerSecond={zoomLevel.pixelsPerSecond}
          />

          {/* Scene markers */}
          <TimelineMarkers
            markers={sceneMarkers}
            pixelsPerSecond={zoomLevel.pixelsPerSecond}
            height={400}
          />

          {/* Playhead */}
          <TimelinePlayhead
            currentTime={currentTime}
            pixelsPerSecond={zoomLevel.pixelsPerSecond}
            height={500}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-border bg-muted/20 px-4 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-green-500" />
          <span>已生成视频</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-blue-500" />
          <span>已生成分镜</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-amber-500" />
          <span>生成中</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-red-500" />
          <span>生成失败</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-gray-500" />
          <span>未生成</span>
        </div>
      </div>
    </div>
  );
}
