"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "antd";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import type { DramaProject, DramaEpisode, DramaShot } from "../../types";
import { TimelineContainer } from "./timeline-container";
import { TimelinePreview } from "./timeline-preview";
import { TimelineExportDialog } from "./timeline-export-dialog";

type TimelineEditorProps = {
  project: DramaProject;
  episode: DramaEpisode;
  onUpdateShot: (shotId: string, updates: Partial<DramaShot>) => void;
  onReorderShots: (shotId: string, newOrder: number) => void;
  onSelectShot?: (shotId: string) => void;
};

export function TimelineEditor({
  project,
  episode,
  onUpdateShot,
  onReorderShots,
  onSelectShot,
}: TimelineEditorProps) {
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const shots = useMemo(() => episode.shots || [], [episode.shots]);
  const scenes = useMemo(() => project.scenes || [], [project.scenes]);

  const handleSelectShots = useCallback((shotIds: string[]) => {
    setSelectedShotIds(shotIds);
    if (shotIds.length === 1 && onSelectShot) {
      onSelectShot(shotIds[0]);
    }
  }, [onSelectShot]);

  const handleDoubleClickShot = useCallback((shotId: string) => {
    if (onSelectShot) {
      onSelectShot(shotId);
    }
  }, [onSelectShot]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleOpenExport = useCallback(() => {
    setShowExportDialog(true);
  }, []);

  const handleCloseExport = useCallback(() => {
    setShowExportDialog(false);
  }, []);

  return (
    <>
      <div className={`flex flex-col gap-4 ${isFullscreen ? "fixed inset-0 z-50 bg-background p-4" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">时间轴编辑器</h2>
            <p className="text-sm text-muted-foreground">
              {project.title} · {episode.title} · {shots.length} 个镜头
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              icon={<Download className="h-4 w-4" />}
              onClick={handleOpenExport}
            >
              导出
            </Button>

            <Button
              icon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              onClick={handleToggleFullscreen}
            >
              {isFullscreen ? "退出全屏" : "全屏"}
            </Button>
          </div>
        </div>

        {/* Main editor area */}
        <div className="grid flex-1 gap-4 lg:grid-cols-2">
          {/* Timeline */}
          <div className="flex flex-col overflow-hidden">
            <TimelineContainer
              shots={shots}
              scenes={scenes}
              selectedShotIds={selectedShotIds}
              onSelectShots={handleSelectShots}
              onUpdateShot={onUpdateShot}
              onReorderShots={onReorderShots}
              onDoubleClickShot={handleDoubleClickShot}
            />
          </div>

          {/* Preview */}
          <div className="flex flex-col overflow-hidden">
            <TimelinePreview
              shots={shots}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onTimeUpdate={setCurrentTime}
            />
          </div>
        </div>

        {/* Instructions */}
        {!isFullscreen && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <h3 className="mb-2 text-sm font-medium">操作说明</h3>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <span className="font-medium">拖拽镜头块:</span> 调整镜头顺序
              </div>
              <div>
                <span className="font-medium">拖拽边缘:</span> 调整镜头时长
              </div>
              <div>
                <span className="font-medium">双击镜头块:</span> 编辑镜头详情
              </div>
              <div>
                <span className="font-medium">点击时间轴:</span> 跳转到指定时间
              </div>
              <div>
                <span className="font-medium">滚轮缩放:</span> 调整时间轴比例
              </div>
              <div>
                <span className="font-medium">Ctrl/Cmd+点击:</span> 多选镜头
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export dialog */}
      <TimelineExportDialog
        open={showExportDialog}
        onClose={handleCloseExport}
        project={project}
        episode={episode}
        shots={shots}
      />
    </>
  );
}
