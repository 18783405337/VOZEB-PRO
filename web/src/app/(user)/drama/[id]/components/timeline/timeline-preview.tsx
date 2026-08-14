"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Spin } from "antd";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import type { DramaShot } from "../../types";
import { findShotAtTime, formatTime } from "./timeline-utils";

type TimelinePreviewProps = {
  shots: DramaShot[];
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate?: (time: number) => void;
};

export function TimelinePreview({
  shots,
  currentTime,
  isPlaying,
  onTimeUpdate,
}: TimelinePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Find current shot at the playback time
  const currentShot = useMemo(() => {
    return findShotAtTime(shots, currentTime);
  }, [shots, currentTime]);

  // Sync video playback with timeline
  useEffect(() => {
    if (!videoRef.current || !currentShot?.videoUrl) return;

    if (isPlaying && !isVideoPlaying) {
      videoRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
      setIsVideoPlaying(true);
    } else if (!isPlaying && isVideoPlaying) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  }, [isPlaying, currentShot, isVideoPlaying]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!videoRef.current) return;

    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current && onTimeUpdate) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  }, [onTimeUpdate]);

  // Render preview content based on shot status
  const renderPreview = () => {
    if (!currentShot) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <p className="text-sm">无可预览内容</p>
        </div>
      );
    }

    // Video preview
    if (currentShot.videoUrl) {
      return (
        <div className="relative h-full w-full bg-black">
          <video
            ref={videoRef}
            src={currentShot.videoUrl}
            className="h-full w-full object-contain"
            muted={isMuted}
            loop
            onTimeUpdate={handleVideoTimeUpdate}
          />

          {/* Video controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center gap-2 text-white">
              <Button
                size="small"
                type="text"
                icon={isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                onClick={handleToggleMute}
                className="!text-white hover:!bg-white/20"
              />

              <div className="flex-1 text-xs">
                <p className="font-medium">{currentShot.title}</p>
                <p className="text-white/70">#{currentShot.order}</p>
              </div>

              <Button
                size="small"
                type="text"
                icon={<Maximize2 className="h-4 w-4" />}
                onClick={handleToggleFullscreen}
                className="!text-white hover:!bg-white/20"
              />
            </div>
          </div>
        </div>
      );
    }

    // Storyboard image preview
    if (currentShot.storyboardImageUrl) {
      return (
        <div className="relative flex h-full w-full items-center justify-center bg-muted/20">
          <img
            src={currentShot.storyboardImageUrl}
            alt={currentShot.title}
            className="max-h-full max-w-full object-contain"
          />

          {/* Image info overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="text-white">
              <p className="text-xs font-medium">{currentShot.title}</p>
              <p className="text-xs text-white/70">分镜预览 · #{currentShot.order}</p>
            </div>
          </div>
        </div>
      );
    }

    // Generation in progress
    if (
      currentShot.generationStatus === "running" ||
      currentShot.generationStatus === "queued" ||
      currentShot.storyboardStatus === "running" ||
      currentShot.storyboardStatus === "queued"
    ) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <Spin size="large" />
          <p className="text-sm">生成中...</p>
          <p className="text-xs">#{currentShot.order} {currentShot.title}</p>
        </div>
      );
    }

    // Error state
    if (currentShot.generationStatus === "error" || currentShot.storyboardStatus === "error") {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <p className="text-sm text-red-500">生成失败</p>
          <p className="text-xs">#{currentShot.order} {currentShot.title}</p>
          {currentShot.generationError && (
            <p className="max-w-md text-center text-xs text-muted-foreground">
              {currentShot.generationError}
            </p>
          )}
        </div>
      );
    }

    // No content yet
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/10 text-muted-foreground">
        <div className="max-w-md space-y-2 p-4">
          <p className="text-sm font-medium">#{currentShot.order} {currentShot.title}</p>
          <p className="text-xs">{currentShot.description || currentShot.imagePrompt || "尚未生成内容"}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">预览</span>
          {currentShot && (
            <span className="text-xs text-muted-foreground">
              {formatTime(currentTime)}
            </span>
          )}
        </div>

        {currentShot && (
          <div className="flex items-center gap-2">
            {currentShot.videoUrl && (
              <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                视频
              </span>
            )}
            {currentShot.storyboardImageUrl && !currentShot.videoUrl && (
              <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
                分镜
              </span>
            )}
          </div>
        )}
      </div>

      {/* Preview area */}
      <div className="relative flex-1 overflow-hidden">
        {renderPreview()}
      </div>

      {/* Shot info footer */}
      {currentShot && (
        <div className="border-t border-border bg-muted/20 px-4 py-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">时长: </span>
              <span className="font-medium">{formatTime(currentShot.duration)}</span>
            </div>
            {currentShot.dialogue && (
              <div className="col-span-2">
                <span className="text-muted-foreground">对白: </span>
                <span>{currentShot.dialogue.substring(0, 100)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
