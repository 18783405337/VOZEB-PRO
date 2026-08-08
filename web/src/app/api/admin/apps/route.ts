import { apiError, apiOk } from "@/app/api/_shared/api-response";
import { appRegistry } from "@/lib/apps/app-registry";
import { requirePlatformPermission } from "@/lib/server/authorization/authorization-service";
import { createPostgresRepositories, isPostgresDatabaseEnabled } from "@/lib/server/database";
import type { PublishedAppVersion } from "@/lib/server/database/app-center-repository";
import { isAppCenterEnabled } from "@/lib/server/tenant/saas-feature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    if (!isAppCenterEnabled() || !isPostgresDatabaseEnabled()) return apiError(501, "Application center requires PostgreSQL");

    try {
        await requirePlatformPermission(request, "platform.apps.publish");
        const published = await createPostgresRepositories().appCenter.listPublished();
        const publishedByVersion = new Map(published.map((item) => [`${item.appKey}@${item.version}`, item]));
        const apps = appRegistry.list().map((definition) => {
            const version = publishedByVersion.get(`${definition.key}@${definition.version}`);
            return {
                appKey: definition.key,
                version: definition.version,
                definition,
                published: Boolean(version),
                publishedAt: version?.publishedAt || null,
            };
        });
        return apiOk({ apps });
    } catch (error) {
        return apiError(error, "Failed to list applications", "platform.apps.list");
    }
}
