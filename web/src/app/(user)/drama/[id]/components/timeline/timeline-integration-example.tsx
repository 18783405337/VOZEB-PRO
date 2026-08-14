/**
 * Timeline Editor Integration Example
 *
 * This file demonstrates how to integrate the timeline editor into the drama editor page
 */

import { useState } from "react";
import { TimelineEditor } from "./components/timeline";
import type { DramaProject, DramaEpisode, DramaShot } from "./types";
import { useDramaStore } from "./stores/use-drama-store";

export function DramaTimelineEditorExample() {
  const [showTimeline, setShowTimeline] = useState(false);

  // Get data from store
  const project = useDramaStore((state) => state.project);
  const activeEpisodeId = useDramaStore((state) => state.activeEpisodeId);
  const updateShot = useDramaStore((state) => state.updateShot);
  const reorderShot = useDramaStore((state) => state.reorderShot);

  // Find active episode
  const episode = project?.episodes.find((e) => e.id === activeEpisodeId);

  if (!project || !episode) {
    return <div>Loading...</div>;
  }

  const handleUpdateShot = (shotId: string, updates: Partial<DramaShot>) => {
    updateShot(project.id, episode.id, shotId, updates);
  };

  const handleReorderShots = (shotId: string, newOrder: number) => {
    // Implement reordering logic
    const shot = episode.shots.find((s) => s.id === shotId);
    if (!shot) return;

    const currentOrder = shot.order;
    if (currentOrder === newOrder) return;

    // Update all affected shots
    episode.shots.forEach((s) => {
      if (currentOrder < newOrder) {
        // Moving forward
        if (s.order > currentOrder && s.order <= newOrder) {
          updateShot(project.id, episode.id, s.id, { order: s.order - 1 });
        }
      } else {
        // Moving backward
        if (s.order >= newOrder && s.order < currentOrder) {
          updateShot(project.id, episode.id, s.id, { order: s.order + 1 });
        }
      }
    });

    // Update the moved shot
    updateShot(project.id, episode.id, shotId, { order: newOrder });
  };

  const handleSelectShot = (shotId: string) => {
    // Scroll to shot in the main editor
    const shotElement = document.getElementById(`shot-${shotId}`);
    if (shotElement) {
      shotElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Toggle button */}
      <button
        onClick={() => setShowTimeline(!showTimeline)}
        className="rounded bg-primary px-4 py-2 text-white"
      >
        {showTimeline ? "隐藏时间轴" : "显示时间轴"}
      </button>

      {/* Timeline editor */}
      {showTimeline && (
        <TimelineEditor
          project={project}
          episode={episode}
          onUpdateShot={handleUpdateShot}
          onReorderShots={handleReorderShots}
          onSelectShot={handleSelectShot}
        />
      )}
    </div>
  );
}

/**
 * Alternative: Standalone timeline page
 */
export function DramaTimelineEditorPage() {
  const project = useDramaStore((state) => state.project);
  const activeEpisodeId = useDramaStore((state) => state.activeEpisodeId);
  const updateShot = useDramaStore((state) => state.updateShot);

  const episode = project?.episodes.find((e) => e.id === activeEpisodeId);

  if (!project || !episode) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">请先选择一个项目和集数</p>
      </div>
    );
  }

  return (
    <div className="h-screen p-4">
      <TimelineEditor
        project={project}
        episode={episode}
        onUpdateShot={(shotId, updates) => {
          updateShot(project.id, episode.id, shotId, updates);
        }}
        onReorderShots={(shotId, newOrder) => {
          // Handle reordering
        }}
        onSelectShot={(shotId) => {
          // Handle selection
        }}
      />
    </div>
  );
}

/**
 * Usage in main drama editor page:
 *
 * Add a tab or section for timeline view:
 */

// In drama/[id]/page.tsx:
//
// import { TimelineEditor } from "./components/timeline";
//
// const [viewMode, setViewMode] = useState<"cards" | "timeline">("cards");
//
// return (
//   <div>
//     <Tabs value={viewMode} onChange={setViewMode}>
//       <Tab value="cards">卡片视图</Tab>
//       <Tab value="timeline">时间轴视图</Tab>
//     </Tabs>
//
//     {viewMode === "cards" ? (
//       <ShotCardsList />
//     ) : (
//       <TimelineEditor
//         project={project}
//         episode={episode}
//         onUpdateShot={handleUpdateShot}
//         onReorderShots={handleReorderShots}
//       />
//     )}
//   </div>
// );
