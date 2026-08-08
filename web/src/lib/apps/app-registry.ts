import { PILOT_WORKFLOW_KEYS, type AppDefinition } from "./app-definition";
import { actionTransfer } from "./definitions/action-transfer";
import { aigcDigitalHuman } from "./definitions/aigc-digital-human";
import { backgroundRemoval } from "./definitions/background-removal";
import { imageHuman } from "./definitions/image-human";
import { productImage } from "./definitions/product-image";
import { productPromoVideo } from "./definitions/product-promo-video";

export type AppRegistry = Readonly<{
    get(appKey: string, version?: string): AppDefinition | undefined;
    list(): readonly AppDefinition[];
}>;

export function createAppRegistry(definitions: readonly AppDefinition[], workflowKeys: readonly string[] = PILOT_WORKFLOW_KEYS): AppRegistry {
    const reviewedWorkflows = new Set(workflowKeys);
    const definitionsByVersion = new Map<string, AppDefinition>();
    const definitionsByKey = new Map<string, AppDefinition>();

    for (const definition of definitions) {
        const identity = `${definition.key}@${definition.version}`;
        if (definitionsByVersion.has(identity)) throw new Error(`Duplicate application version: ${identity}`);
        if (!reviewedWorkflows.has(definition.workflowKey)) throw new Error(`Unknown application workflow: ${definition.workflowKey}`);

        const frozenDefinition = deepFreeze(structuredClone(definition));
        definitionsByVersion.set(identity, frozenDefinition);
        if (!definitionsByKey.has(frozenDefinition.key)) definitionsByKey.set(frozenDefinition.key, frozenDefinition);
    }

    const list = Object.freeze([...definitionsByVersion.values()]);
    return Object.freeze({
        get(appKey, version) {
            return version ? definitionsByVersion.get(`${appKey}@${version}`) : definitionsByKey.get(appKey);
        },
        list() {
            return list;
        },
    });
}

export const appRegistry = createAppRegistry([
    backgroundRemoval,
    productImage,
    productPromoVideo,
    aigcDigitalHuman,
    imageHuman,
    actionTransfer,
]);

function deepFreeze<T>(value: T): T {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    return value;
}
