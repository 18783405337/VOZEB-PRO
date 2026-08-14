/**
 * Timeline export utilities
 */

import type { DramaShot, DramaEpisode, DramaProject } from "../../types";
import { calculateShotStartTimes, formatTime } from "./timeline-utils";

export type ExportFormat = "pdf" | "json" | "csv" | "srt";

/**
 * Export timeline as JSON
 */
export function exportAsJSON(
  project: DramaProject,
  episode: DramaEpisode,
  shots: DramaShot[]
): string {
  const startTimes = calculateShotStartTimes(shots);

  const exportData = {
    project: {
      id: project.id,
      title: project.title,
      style: project.style,
      ratio: project.ratio,
    },
    episode: {
      id: episode.id,
      title: episode.title,
    },
    shots: shots.map((shot) => ({
      order: shot.order,
      title: shot.title,
      startTime: startTimes.get(shot.id) || 0,
      duration: shot.duration,
      description: shot.description,
      dialogue: shot.dialogue,
      narration: shot.narration,
      imagePrompt: shot.imagePrompt,
      videoPrompt: shot.videoPrompt,
      cameraMotion: shot.cameraMotion,
      videoUrl: shot.videoUrl,
      storyboardImageUrl: shot.storyboardImageUrl,
      generationStatus: shot.generationStatus,
    })),
    exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export timeline as CSV
 */
export function exportAsCSV(shots: DramaShot[]): string {
  const startTimes = calculateShotStartTimes(shots);

  const headers = [
    "顺序",
    "标题",
    "开始时间",
    "时长",
    "描述",
    "对白",
    "旁白",
    "画面提示词",
    "动态提示词",
    "镜头运动",
    "状态",
  ];

  const rows = shots.map((shot) => {
    const startTime = startTimes.get(shot.id) || 0;
    const status = shot.generationStatus === "success" ? "已生成" :
                   shot.storyboardStatus === "success" ? "已分镜" : "未生成";

    return [
      shot.order,
      shot.title,
      formatTime(startTime),
      formatTime(shot.duration),
      shot.description,
      shot.dialogue,
      shot.narration,
      shot.imagePrompt,
      shot.videoPrompt,
      shot.cameraMotion,
      status,
    ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`);
  });

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Export timeline as SRT subtitles
 */
export function exportAsSRT(shots: DramaShot[]): string {
  const startTimes = calculateShotStartTimes(shots);
  let srtIndex = 1;
  const srtBlocks: string[] = [];

  shots.forEach((shot) => {
    const startTime = startTimes.get(shot.id) || 0;
    const endTime = startTime + shot.duration;

    // Add dialogue
    if (shot.dialogue) {
      srtBlocks.push(
        `${srtIndex}`,
        `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}`,
        shot.dialogue,
        ""
      );
      srtIndex++;
    }

    // Add narration
    if (shot.narration) {
      srtBlocks.push(
        `${srtIndex}`,
        `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}`,
        `[旁白] ${shot.narration}`,
        ""
      );
      srtIndex++;
    }
  });

  return srtBlocks.join("\n");
}

/**
 * Format time for SRT (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

/**
 * Generate PDF export data (to be rendered by a PDF library)
 */
export function generatePDFData(
  project: DramaProject,
  episode: DramaEpisode,
  shots: DramaShot[]
) {
  const startTimes = calculateShotStartTimes(shots);

  return {
    title: `${project.title} - ${episode.title}`,
    metadata: {
      project: project.title,
      episode: episode.title,
      style: project.style,
      ratio: project.ratio,
      shotCount: shots.length,
      totalDuration: shots.reduce((sum, shot) => sum + shot.duration, 0),
      exportDate: new Date().toISOString(),
    },
    shots: shots.map((shot) => ({
      order: shot.order,
      title: shot.title,
      startTime: formatTime(startTimes.get(shot.id) || 0),
      duration: formatTime(shot.duration),
      description: shot.description,
      dialogue: shot.dialogue,
      narration: shot.narration,
      imagePrompt: shot.imagePrompt,
      videoPrompt: shot.videoPrompt,
      cameraMotion: shot.cameraMotion,
      storyboardImageUrl: shot.storyboardImageUrl,
      continuity: shot.continuity,
    })),
  };
}

/**
 * Download file helper
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export handler
 */
export function handleExport(
  format: ExportFormat,
  project: DramaProject,
  episode: DramaEpisode,
  shots: DramaShot[]
) {
  const timestamp = new Date().toISOString().split("T")[0];
  const baseFilename = `${project.title}_${episode.title}_${timestamp}`;

  switch (format) {
    case "json":
      downloadFile(
        exportAsJSON(project, episode, shots),
        `${baseFilename}.json`,
        "application/json"
      );
      break;

    case "csv":
      downloadFile(
        exportAsCSV(shots),
        `${baseFilename}.csv`,
        "text/csv"
      );
      break;

    case "srt":
      downloadFile(
        exportAsSRT(shots),
        `${baseFilename}.srt`,
        "text/plain"
      );
      break;

    case "pdf":
      // PDF export would require a PDF library like jsPDF or react-pdf
      // For now, we'll generate the data structure
      const pdfData = generatePDFData(project, episode, shots);
      console.log("PDF export data:", pdfData);
      alert("PDF导出功能需要集成PDF生成库");
      break;
  }
}
