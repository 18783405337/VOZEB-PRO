const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function isSaasEnabled() {
    return ENABLED_VALUES.has(process.env.VOZEB_PRO_SAAS_ENABLED?.trim().toLowerCase() ?? "");
}
