import { getCurrentUser } from "@/lib/auth/session";
import { createPostgresRepositories, isPostgresDatabaseEnabled } from "@/lib/server/database";
import type { TenantMemberRecord, TenantRecord } from "@/lib/server/tenant/tenant-types";

import { resolveTenantLookup } from "./tenant-host";

export type TenantContextSource = "domain" | "path" | "default";

export type TenantContext = {
    tenant: TenantRecord;
    source: TenantContextSource;
    member?: TenantMemberRecord;
};

export type TenantContextOptions = {
    allowDefault?: boolean;
    defaultTenantId?: string;
    requireMembership?: boolean;
    user?: { id: string } | null;
};

export class TenantContextError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code: "tenant.not_found" | "tenant.membership_required" | "tenant.postgres_required",
    ) {
        super(message);
        this.name = "TenantContextError";
    }
}

export async function getTenantContext(request: Request, options: TenantContextOptions = {}): Promise<TenantContext> {
    if (!isPostgresDatabaseEnabled()) {
        throw new TenantContextError("Tenant isolation requires PostgreSQL", 501, "tenant.postgres_required");
    }

    const repositories = createPostgresRepositories();
    const lookup = resolveTenantLookup(request);
    let tenant: TenantRecord | null = null;
    let source: TenantContextSource | undefined;

    if (lookup.hostname) {
        tenant = await repositories.tenants.getByVerifiedHostname(lookup.hostname);
        if (tenant) source = "domain";
    }

    if (!tenant && lookup.slug) {
        tenant = await repositories.tenants.getBySlug(lookup.slug);
        if (tenant) source = "path";
    }

    if (!tenant && options.allowDefault !== false) {
        tenant = await repositories.tenants.getById(resolveDefaultTenantId(options.defaultTenantId));
        if (tenant) source = "default";
    }

    if (!tenant || !source || tenant.status !== "active") {
        throw new TenantContextError("Tenant was not found", 404, "tenant.not_found");
    }

    const user = options.user === undefined ? await getCurrentUser(request) : options.user;
    const member = user?.id ? await repositories.tenants.getMember(tenant.id, user.id) : null;

    if (options.requireMembership && (!member || member.status !== "active")) {
        throw new TenantContextError("Active tenant membership is required", 403, "tenant.membership_required");
    }

    return {
        tenant,
        source,
        ...(member?.status === "active" ? { member } : {}),
    };
}

export async function getTrustedTenantId(request: Request, user?: { id: string } | null) {
    if (!isPostgresDatabaseEnabled()) return "default";
    return (await getTenantContext(request, { user, requireMembership: true })).tenant.id;
}

function resolveDefaultTenantId(value?: string) {
    return value?.trim() || process.env.VOZEB_PRO_DEFAULT_TENANT_ID?.trim() || "default";
}
