"use client";

import { useState } from "react";
import { Modal, Radio, Button, Space, Divider } from "antd";
import { Download, FileJson, FileSpreadsheet, FileText, FileType } from "lucide-react";
import type { DramaProject, DramaEpisode, DramaShot } from "../../types";
import { handleExport, type ExportFormat } from "./timeline-export";

type TimelineExportDialogProps = {
  open: boolean;
  onClose: () => void;
  project: DramaProject;
  episode: DramaEpisode;
  shots: DramaShot[];
};

export function TimelineExportDialog({
  open,
  onClose,
  project,
  episode,
  shots,
}: TimelineExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("json");
  const [isExporting, setIsExporting] = useState(false);

  const handleConfirmExport = async () => {
    setIsExporting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate async operation
      handleExport(selectedFormat, project, episode, shots);
      onClose();
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = [
    {
      value: "json" as ExportFormat,
      label: "JSON",
      description: "包含完整项目数据的JSON文件",
      icon: <FileJson className="h-5 w-5" />,
    },
    {
      value: "csv" as ExportFormat,
      label: "CSV",
      description: "表格格式，可在Excel中打开",
      icon: <FileSpreadsheet className="h-5 w-5" />,
    },
    {
      value: "srt" as ExportFormat,
      label: "SRT字幕",
      description: "导出对白和旁白为字幕文件",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      value: "pdf" as ExportFormat,
      label: "PDF",
      description: "完整的分镜脚本文档（开发中）",
      icon: <FileType className="h-5 w-5" />,
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          <span>导出时间轴</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            icon={<Download className="h-4 w-4" />}
            loading={isExporting}
            onClick={handleConfirmExport}
          >
            导出
          </Button>
        </div>
      }
      width={600}
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            选择导出格式以保存时间轴数据
          </p>
        </div>

        <Divider className="my-4" />

        <Radio.Group
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
          className="w-full"
        >
          <Space direction="vertical" className="w-full" size="middle">
            {formatOptions.map((option) => (
              <Radio
                key={option.value}
                value={option.value}
                className="w-full rounded border border-border p-3 transition-colors hover:border-primary hover:bg-muted/30"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-primary">{option.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                </div>
              </Radio>
            ))}
          </Space>
        </Radio.Group>

        <Divider className="my-4" />

        <div className="rounded bg-muted/30 p-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">项目: </span>
              <span className="font-medium">{project.title}</span>
            </div>
            <div>
              <span className="text-muted-foreground">集数: </span>
              <span className="font-medium">{episode.title}</span>
            </div>
            <div>
              <span className="text-muted-foreground">镜头数: </span>
              <span className="font-medium">{shots.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">总时长: </span>
              <span className="font-medium">
                {Math.floor(shots.reduce((sum, shot) => sum + shot.duration, 0))}秒
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
