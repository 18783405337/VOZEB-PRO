import { isPostgresDatabaseEnabled } from "@/lib/server/database";
import { updatePostgresAuthSettings, updatePostgresSystemChannelHealth } from "./postgres-auth-settings-service";
import { normalizeSettings } from "./store-normalizers";
import { mutateAuthDb, readAuthDb, readPostgresAuthSettings } from "./store-repository";
import type { AuthSettings, SystemChannelHealthSnapshot } from "./store-types";

const AUTH_SETTINGS_CACHE_TTL_MS = 1000;
let postgresAuthSettingsCache: { value: AuthSettings; expiresAt: number } | null = null;
let postgresAuthSettingsRequest: Promise<AuthSettings> | null = null;
let postgresAuthSettingsVersion = 0;

export async function getAuthSettings() {
    if (isPostgresDatabaseEnabled()) {
        const now = Date.now();
        if (postgresAuthSettingsCache && postgresAuthSettingsCache.expiresAt > now) return postgresAuthSettingsCache.value;
        if (postgresAuthSettingsRequest) return postgresAuthSettingsRequest;
        const requestVersion = postgresAuthSettingsVersion;
        const request = readPostgresAuthSettings().then((settings) => {
            if (requestVersion === postgresAuthSettingsVersion) postgresAuthSettingsCache = { value: settings, expiresAt: Date.now() + AUTH_SETTINGS_CACHE_TTL_MS };
            return settings;
        });
        postgresAuthSettingsRequest = request;
        void request.then(
            () => {
                if (postgresAuthSettingsRequest === request) postgresAuthSettingsRequest = null;
            },
            () => {
                if (postgresAuthSettingsRequest === request) postgresAuthSettingsRequest = null;
            },
        );
        return request;
    }
    return (await readAuthDb()).settings;
}

export async function setAuthSettings(patch: Partial<AuthSettings>) {
    const settings = isPostgresDatabaseEnabled()
        ? await updatePostgresAuthSettings(patch)
        : await mutateAuthDb((db) => {
              db.settings = normalizeSettings({ ...db.settings, ...patch });
              return db.settings;
          });
    updatePostgresCache(settings);
    return settings;
}

export async function setSystemChannelHealthResult(channelId: string, result: SystemChannelHealthSnapshot) {
    const settings = isPostgresDatabaseEnabled()
        ? await updatePostgresSystemChannelHealth(channelId, result)
        : await mutateAuthDb((db) => {
              db.settings = normalizeSettings({
                  ...db.settings,
                  systemChannels: db.settings.systemChannels.map((channel) =>
                      channel.id === channelId
                          ? {
                                ...channel,
                                healthResults: { ...(channel.healthResults || {}), [result.kind]: result },
                            }
                          : channel,
                  ),
              });
              return db.settings;
          });
    updatePostgresCache(settings);
    return settings;
}

function updatePostgresCache(settings: AuthSettings) {
    if (!isPostgresDatabaseEnabled()) return;
    postgresAuthSettingsVersion += 1;
    postgresAuthSettingsCache = { value: settings, expiresAt: Date.now() + AUTH_SETTINGS_CACHE_TTL_MS };
}
