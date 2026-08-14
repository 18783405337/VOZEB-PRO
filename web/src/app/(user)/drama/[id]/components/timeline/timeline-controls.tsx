"use client";

import { Button, Slider, Tooltip } from "antd";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Repeat,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatTime } from "./timeline-utils";
import type { TimelineZoomLevel } from "./timeline-types";

type TimelineControlsProps = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loop: boolean;
  playbackRate: 1 | 1.5 | 2;
  zoomLevel: TimelineZoomLevel;
  availableZoomLevels: TimelineZoomLevel[];
  onPlayPause: () => void;
  onStop: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onSeek: (time: number) => void;
  onToggleLoop: () => void;
  onChangePlaybackRate: (rate: 1 | 1.5 | 2) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function TimelineControls({
  isPlaying,
  currentTime,
  duration,
  loop,
  playbackRate,
  zoomLevel,
  availableZoomLevels,
  onPlayPause,
  onStop,
  onSkipBack,
  onSkipForward,
  onSeek,
  onToggleLoop,
  onChangePlaybackRate,
  onZoomIn,
  onZoomOut,
}: TimelineControlsProps) {
  const currentZoomIndex = availableZoomLevels.findIndex(
    (level) => level.pixelsPerSecond === zoomLevel.pixelsPerSecond
  );
  const canZoomIn = currentZoomIndex < availableZoomLevels.length - 1;
  const canZoomOut = currentZoomIndex > 0;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/30 p-2">
      {/* Playback controls */}
      <div className="flex items-center gap-1">
        <Tooltip title="快退5秒">
          <Button
            size="small"
            icon={<SkipBack className="h-4 w-4" />}
            onClick={onSkipBack}
          />
        </Tooltip>

        <Tooltip title={isPlaying ? "暂停" : "播放"}>
          <Button
            size="small"
            type="primary"
            icon={isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            onClick={onPlayPause}
          />
        </Tooltip>

        <Tooltip title="快进5秒">
          <Button
            size="small"
            icon={<SkipForward className="h-4 w-4" />}
            onClick={onSkipForward}
          />
        </Tooltip>

        <Tooltip title={loop ? "取消循环" : "循环播放"}>
          <Button
            size="small"
            icon={<Repeat className={`h-4 w-4 ${loop ? "text-blue-500" : ""}`} />}
            onClick={onToggleLoop}
            type={loop ? "primary" : "default"}
          />
        </Tooltip>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Time display */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium tabular-nums">
          {formatTime(currentTime)}
        </span>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatTime(duration)}
        </span>
      </div>

      {/* Playback rate */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">速度:</span>
        <select
          value={playbackRate}
          onChange={(e) => onChangePlaybackRate(Number(e.target.value) as 1 | 1.5 | 2)}
          className="h-7 rounded border border-border bg-background px-2 text-xs"
        >
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Tooltip title="缩小">
          <Button
            size="small"
            icon={<ZoomOut className="h-4 w-4" />}
            onClick={onZoomOut}
            disabled={!canZoomOut}
          />
        </Tooltip>

        <span className="min-w-[3rem] text-center text-xs font-medium">
          {zoomLevel.label}
        </span>

        <Tooltip title="放大">
          <Button
            size="small"
            icon={<ZoomIn className="h-4 w-4" />}
            onClick={onZoomIn}
            disabled={!canZoomIn}
          />
        </Tooltip>
      </div>

      {/* Progress slider */}
      <div className="ml-auto flex-1">
        <Slider
          min={0}
          max={duration}
          step={0.1}
          value={currentTime}
          onChange={onSeek}
          tooltip={{ formatter: (value) => formatTime(value || 0) }}
        />
      </div>
    </div>
  );
}
