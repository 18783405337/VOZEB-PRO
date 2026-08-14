import { CanvasNodeType } from "./types";
import type { CanvasNodeMetadata } from "./types";
import { PANORAMA_NODE_SIZE } from "./utils/canvas-panorama";

type CanvasNodeSpec = {
    width: number;
    height: number;
    title: string;
    metadata?: CanvasNodeMetadata;
};

export const NODE_DEFAULT_SIZE = {
    [CanvasNodeType.Image]: { width: 340, height: 240, title: "New Generation" },
    [CanvasNodeType.Panorama]: { ...PANORAMA_NODE_SIZE, title: "全景图" },
    [CanvasNodeType.Text]: { width: 340, height: 240, title: "Note" },
    [CanvasNodeType.Config]: { width: 340, height: 240, title: "生成配置" },
    [CanvasNodeType.Video]: { width: 420, height: 236, title: "Video" },
    [CanvasNodeType.Audio]: { width: 340, height: 120, title: "Audio" },
    [CanvasNodeType.Brief]: { width: 380, height: 280, title: "创作简报" },
    [CanvasNodeType.Task]: { width: 340, height: 210, title: "Agent 任务" },
    [CanvasNodeType.BrandKit]: { width: 340, height: 240, title: "品牌规范" },
    [CanvasNodeType.Drawing]: { width: 480, height: 360, title: "绘图画板" },
    [CanvasNodeType.Skill]: { width: 400, height: 320, title: "技能节点" },
    [CanvasNodeType.Frame]: { width: 600, height: 400, title: "新框架" },
    [CanvasNodeType.Storyboard]: { width: 800, height: 600, title: "分镜脚本" },
    [CanvasNodeType.Director3D]: { width: 640, height: 480, title: "3D导演台" },
} satisfies Record<CanvasNodeType, { width: number; height: number; title: string }>;

const NODE_SPECS = {
    [CanvasNodeType.Image]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Image],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Panorama]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Panorama],
        metadata: { content: "", status: "idle", size: "2048x1024", panoramaProjection: "equirectangular" },
    },
    [CanvasNodeType.Text]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Text],
        metadata: { content: "", status: "idle", fontSize: 14 },
    },
    [CanvasNodeType.Config]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Config],
        metadata: { content: "", status: "idle", generationMode: "image" },
    },
    [CanvasNodeType.Video]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Video],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Audio]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Audio],
        metadata: { content: "", status: "idle" },
    },
    [CanvasNodeType.Brief]: { ...NODE_DEFAULT_SIZE[CanvasNodeType.Brief], metadata: { status: "idle" } },
    [CanvasNodeType.Task]: { ...NODE_DEFAULT_SIZE[CanvasNodeType.Task], metadata: { status: "idle", agentTaskStatus: "pending", agentTaskAttempts: 0 } },
    [CanvasNodeType.BrandKit]: { ...NODE_DEFAULT_SIZE[CanvasNodeType.BrandKit], metadata: { status: "idle" } },
    [CanvasNodeType.Drawing]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Drawing],
        metadata: {
            status: "idle",
            drawingId: `drawing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            drawingEngine: "tldraw",
            drawingRevision: 0,
            drawingShapeCount: 0,
            drawingPageCount: 1,
        },
    },
    [CanvasNodeType.Skill]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Skill],
        metadata: {
            status: "idle",
            skillId: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            skillTemplateId: "",
            skillStatus: "idle",
            skillProgress: 0,
            skillParameters: {},
        },
    },
    [CanvasNodeType.Frame]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Frame],
        metadata: {
            status: "idle",
            frameId: `frame-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            frameColor: "blue",
            frameBackgroundOpacity: 0.05,
            frameShowTitle: true,
            frameChildNodeIds: [],
        },
    },
    [CanvasNodeType.Storyboard]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Storyboard],
        metadata: {
            status: "idle",
            storyboardId: `storyboard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            storyboardRevision: 0,
            storyboardShotCount: 0,
            storyboardSceneCount: 0,
            storyboardTotalDuration: 0,
        },
    },
    [CanvasNodeType.Director3D]: {
        ...NODE_DEFAULT_SIZE[CanvasNodeType.Director3D],
        metadata: {
            status: "idle",
            director3DId: `director3d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            director3DRevision: 0,
            director3DCameraCount: 1,
            director3DLightCount: 2,
            director3DModelCount: 0,
            director3DSceneData: {
                cameras: [
                    {
                        id: "main-camera",
                        name: "主相机",
                        position: [5, 5, 5],
                        target: [0, 0, 0],
                        fov: 75,
                        aspect: 4 / 3,
                        near: 0.1,
                        far: 1000,
                    },
                ],
                lights: [
                    {
                        id: "ambient-light",
                        name: "环境光",
                        type: "ambient",
                        color: "#404040",
                        intensity: 0.5,
                    },
                    {
                        id: "directional-light",
                        name: "主光源",
                        type: "directional",
                        color: "#ffffff",
                        intensity: 1.0,
                        position: [10, 10, 10],
                        direction: [-1, -1, -1],
                    },
                ],
                models: [],
                environment: {
                    backgroundColor: "#1a1a1a",
                    gridVisible: true,
                    axesVisible: true,
                },
            },
        },
    },
} satisfies Record<CanvasNodeType, CanvasNodeSpec>;

export function getNodeSpec(type: CanvasNodeType) {
    return NODE_SPECS[type];
}
