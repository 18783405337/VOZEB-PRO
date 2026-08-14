/**
 * 3D Director Types
 *
 * 3D导演台相关的类型定义
 */

export type Vector3 = [number, number, number];

export type Camera3D = {
    id: string;
    name: string;
    position: Vector3;
    target: Vector3;
    fov: number;
    aspect: number;
    near: number;
    far: number;
};

export type LightType = "ambient" | "directional" | "point" | "spot";

export type Light3D = {
    id: string;
    name: string;
    type: LightType;
    color: string;
    intensity: number;
    position?: Vector3;
    direction?: Vector3;
    castShadow?: boolean;
};

export type Model3D = {
    id: string;
    name: string;
    url: string;
    storageKey?: string;
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
    visible?: boolean;
};

export type Environment3D = {
    backgroundColor: string;
    gridVisible: boolean;
    axesVisible: boolean;
    shadowsEnabled?: boolean;
    fogEnabled?: boolean;
    fogColor?: string;
    fogNear?: number;
    fogFar?: number;
};

export type Scene3DSnapshot = {
    cameras: Camera3D[];
    lights: Light3D[];
    models: Model3D[];
    environment: Environment3D;
    activeCamera?: string;
};

export type Director3DScene = {
    id: string;
    projectId: string;
    userId: string;
    sceneId: string;
    snapshot: Scene3DSnapshot;
    revision: number;
    cameraCount: number;
    lightCount: number;
    modelCount: number;
    previewUrl: string | null;
    previewStorageKey: string | null;
    thumbnailUrl: string | null;
    thumbnailStorageKey: string | null;
    renderMetadata: any | null;
    createdAt: string;
    updatedAt: string;
};

export type Director3DVersion = {
    revision: number;
    cameraCount: number;
    lightCount: number;
    modelCount: number;
    description: string | null;
    createdAt: string;
};

/**
 * 3D导演台工具类型
 */
export type Director3DTool =
    | "select"
    | "move"
    | "rotate"
    | "scale"
    | "camera"
    | "light";

/**
 * 3D导演台视图模式
 */
export type Director3DViewMode =
    | "perspective"
    | "orthographic"
    | "top"
    | "front"
    | "side";

/**
 * 选中对象类型
 */
export type Selected3DObject = {
    type: "camera" | "light" | "model";
    id: string;
};
