import { createPostgresRepositories, ensurePostgresSchema, withPostgresTransaction, type JsonValue } from "@/lib/server/database";

import { AuthInputError } from "./store-foundation";
import { encryptAuthSettingsSecrets, normalizeSettings } from "./store-normalizers";
import { readPostgresAuthSettings } from "./store-repository";
import type { AuthSettings, SystemChannelHealthSnapshot } from "./store-types";

export async function updatePostgresAuthSettings(patch: Partial<AuthSettings>) {
    await ensurePostgresSchema();
    return withPostgresTransaction(async (client) => {
        const settingsRepository = createPostgresRepositories(client).settings;
        await settingsRepository.lock();
        const settings = normalizeSettings({ ...(await readPostgresAuthSettings(client)), ...patch });
        const encrypted = encryptAuthSettingsSecrets(settings);

        for (const [sortOrder, plan] of settings.entitlements.plans.entries()) {
            await settingsRepository.upsertEntitlementPlan({
                id: plan.id,
                name: plan.name,
                enabled: plan.enabled,
                dailyPoints: plan.dailyPoints,
                limits: asJson(plan.limits),
                features: asJson(plan.features),
                sortOrder,
            });
        }

        await settingsRepository.updateSettings({
            site: asJson(encrypted.site),
            registrationEnabled: encrypted.registrationEnabled,
            emailRegistrationEnabled: encrypted.emailRegistrationEnabled,
            freeDailyPointsEnabled: encrypted.freeDailyPointsEnabled,
            freeDailyPoints: encrypted.freeDailyPoints,
            mail: asJson(encrypted.mail),
            allowUserApiConfig: encrypted.allowUserApiConfig,
            modelPointCosts: asJson(encrypted.modelPointCosts),
            generationPointMultipliers: asJson(encrypted.generationPointMultipliers),
            entitlementsEnabled: encrypted.entitlements.enabled,
            defaultPlanId: encrypted.entitlements.defaultPlanId,
            generationConcurrency: asJson(encrypted.generationConcurrency),
            generationDefaults: asJson(encrypted.generationDefaults),
            logicalModels: asJson(encrypted.logicalModels),
            defaultModels: asJson(encrypted.defaultModels),
            agentSkills: asJson(encrypted.agentSkills),
        });

        for (const [sortOrder, channel] of encrypted.systemChannels.entries()) {
            await settingsRepository.upsertSystemModelChannel({
                id: channel.id,
                name: channel.name,
                baseUrl: channel.baseUrl,
                apiKeyCiphertext: channel.apiKey,
                webhookSecretCiphertext: channel.webhookSecret || "",
                apiFormat: channel.apiFormat,
                models: asJson(channel.models),
                enabled: channel.enabled,
                advancedConfig: channel.advancedConfig ? asJson(channel.advancedConfig) : undefined,
                healthResults: asJson(channel.healthResults || {}),
                sortOrder,
            });
        }
        await settingsRepository.deleteSystemModelChannelsNotIn(encrypted.systemChannels.map((channel) => channel.id));

        const retainedPlans = await settingsRepository.removeEntitlementPlansNotIn(encrypted.entitlements.plans.map((plan) => plan.id));
        if (retainedPlans.length) throw new AuthInputError(`套餐仍被用户或订单引用，无法删除：${retainedPlans.join("、")}`);
        return settings;
    });
}

export async function updatePostgresSystemChannelHealth(channelId: string, result: SystemChannelHealthSnapshot) {
    await ensurePostgresSchema();
    return withPostgresTransaction(async (client) => {
        const settingsRepository = createPostgresRepositories(client).settings;
        await settingsRepository.lock();
        const channel = await settingsRepository.getSystemModelChannelById(channelId, true);
        if (channel) {
            const healthResults = isRecord(channel.healthResults) ? channel.healthResults : {};
            await settingsRepository.updateSystemModelChannelHealth(channelId, asJson({ ...healthResults, [result.kind]: result }));
        }
        return readPostgresAuthSettings(client);
    });
}

function asJson(value: unknown) {
    return value as JsonValue;
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
