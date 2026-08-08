export type AppConfigResolutionInput = Readonly<{
    platformDefaults?: Record<string, unknown>;
    tenantOverrides?: Record<string, unknown>;
    installSettings?: Record<string, unknown>;
    requestOverrides?: Record<string, unknown>;
    allowedRequestOverrideKeys?: readonly string[];
}>;

export function resolveAppConfig(input: AppConfigResolutionInput): Record<string, unknown> {
    const resolved = copySafeEntries({}, input.platformDefaults);
    copySafeEntries(resolved, input.tenantOverrides);
    copySafeEntries(resolved, input.installSettings);

    const allowedKeys = new Set(input.allowedRequestOverrideKeys || []);
    for (const [key, value] of Object.entries(input.requestOverrides || {})) {
        if (allowedKeys.has(key) && isSafeKey(key)) resolved[key] = value;
    }

    return resolved;
}

function copySafeEntries(target: Record<string, unknown>, source: Record<string, unknown> | undefined) {
    for (const [key, value] of Object.entries(source || {})) {
        if (isSafeKey(key)) target[key] = value;
    }
    return target;
}

function isSafeKey(key: string) {
    return key !== "__proto__" && key !== "constructor" && key !== "prototype";
}
