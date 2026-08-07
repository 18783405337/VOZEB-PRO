import { randomUUID } from "node:crypto";

import type { QueryExecutor } from "@/lib/server/database/postgres";
import type { AddTenantMemberInput, CreateTenantWithOwnerInput, TenantMemberRecord, TenantMemberStatus, TenantRecord, TenantStatus } from "@/lib/server/tenant/tenant-types";

import { isoValue, optionalString, stringValue } from "./repository-shared";

export const DEFAULT_TENANT_OWNER_PERMISSIONS = ["tenant.members.read", "tenant.members.manage", "tenant.roles.manage", "tenant.apps.read", "tenant.apps.configure", "tenant.billing.read", "tenant.merchants.manage"] as const;

export type TenantTransactionRunner = <T>(handler: (executor: QueryExecutor) => Promise<T>) => Promise<T>;

export class TenantRepository {
    private readonly transaction: TenantTransactionRunner;

    constructor(
        private readonly db: QueryExecutor,
        transaction?: TenantTransactionRunner,
    ) {
        this.transaction = transaction || ((handler) => handler(this.db));
    }

    async getById(id: string): Promise<TenantRecord | null> {
        const result = await this.db.query("SELECT * FROM tenants WHERE id = $1", [id]);
        return result.rows[0] ? mapTenant(result.rows[0]) : null;
    }

    async getBySlug(slug: string): Promise<TenantRecord | null> {
        const result = await this.db.query("SELECT * FROM tenants WHERE lower(slug) = lower($1)", [slug.trim()]);
        return result.rows[0] ? mapTenant(result.rows[0]) : null;
    }

    async getByVerifiedHostname(hostname: string): Promise<TenantRecord | null> {
        const result = await this.db.query(
            `SELECT t.*
             FROM tenants t
             JOIN tenant_domains td ON td.tenant_id = t.id
             WHERE lower(td.hostname) = lower($1)
               AND td.status = 'verified' AND t.status = 'active'`,
            [hostname.trim().toLowerCase()],
        );
        return result.rows[0] ? mapTenant(result.rows[0]) : null;
    }

    async createWithOwner(input: CreateTenantWithOwnerInput): Promise<TenantRecord> {
        const tenantId = input.id?.trim() || randomUUID();
        const ownerRoleId = input.ownerRoleId?.trim() || randomUUID();
        const slug = requiredText(input.slug, "Tenant slug");
        const name = requiredText(input.name, "Tenant name");
        const ownerUserId = requiredText(input.ownerUserId, "Tenant owner user id");
        const permissions = [...new Set(input.ownerPermissions || DEFAULT_TENANT_OWNER_PERMISSIONS)];

        return this.transaction(async (executor) => {
            const tenantResult = await executor.query(
                `INSERT INTO tenants (id, slug, name, status, owner_user_id, settings)
                 VALUES ($1, $2, $3, 'active', $4, $5::jsonb)
                 RETURNING *`,
                [tenantId, slug, name, ownerUserId, JSON.stringify(input.settings || {})],
            );
            const tenant = tenantResult.rows[0];
            if (!tenant) throw new Error("Tenant creation did not return a record");

            await executor.query(
                `INSERT INTO tenant_roles (id, tenant_id, key, name, system)
                 VALUES ($1, $2, 'owner', 'Owner', true)`,
                [ownerRoleId, tenantId],
            );
            await executor.query(
                `INSERT INTO tenant_role_permissions (tenant_id, role_id, permission)
                 SELECT $1, $2, permission
                 FROM unnest($3::text[]) AS permission`,
                [tenantId, ownerRoleId, permissions],
            );
            await executor.query(
                `INSERT INTO tenant_members (tenant_id, user_id, role_id, status)
                 VALUES ($1, $2, $3, 'active')`,
                [tenantId, ownerUserId, ownerRoleId],
            );

            return mapTenant(tenant);
        });
    }

    async updateStatus(tenantId: string, status: TenantStatus): Promise<TenantRecord | null> {
        const result = await this.db.query("UPDATE tenants SET status = $2 WHERE id = $1 RETURNING *", [tenantId, status]);
        return result.rows[0] ? mapTenant(result.rows[0]) : null;
    }

    async getMember(tenantId: string, userId: string): Promise<TenantMemberRecord | null> {
        const result = await this.db.query(
            `SELECT tm.*, tr.key AS role_key,
                    coalesce(array_agg(DISTINCT trp.permission ORDER BY trp.permission) FILTER (WHERE trp.permission IS NOT NULL), '{}'::text[]) AS permissions
             FROM tenant_members tm
             JOIN tenant_roles tr ON tr.id = tm.role_id AND tr.tenant_id = tm.tenant_id
             LEFT JOIN tenant_role_permissions trp ON trp.role_id = tr.id AND trp.tenant_id = tm.tenant_id
             WHERE tm.tenant_id = $1 AND tm.user_id = $2
             GROUP BY tm.tenant_id, tm.user_id, tm.role_id, tm.status, tm.joined_at, tm.updated_at, tr.key`,
            [tenantId, userId],
        );
        return result.rows[0] ? mapTenantMember(result.rows[0]) : null;
    }

    async listMembers(tenantId: string): Promise<TenantMemberRecord[]> {
        const result = await this.db.query(
            `SELECT tm.*, tr.key AS role_key,
                    coalesce(array_agg(DISTINCT trp.permission ORDER BY trp.permission) FILTER (WHERE trp.permission IS NOT NULL), '{}'::text[]) AS permissions
             FROM tenant_members tm
             JOIN tenant_roles tr ON tr.id = tm.role_id AND tr.tenant_id = tm.tenant_id
             LEFT JOIN tenant_role_permissions trp ON trp.role_id = tr.id AND trp.tenant_id = tm.tenant_id
             WHERE tm.tenant_id = $1
             GROUP BY tm.tenant_id, tm.user_id, tm.role_id, tm.status, tm.joined_at, tm.updated_at, tr.key
             ORDER BY tm.joined_at ASC, tm.user_id ASC`,
            [tenantId],
        );
        return result.rows.map(mapTenantMember);
    }

    async addMember(input: AddTenantMemberInput): Promise<TenantMemberRecord> {
        const status = input.status || "active";
        const result = await this.db.query(
            `INSERT INTO tenant_members (tenant_id, user_id, role_id, status)
             SELECT $1, $2, tr.id, $4
             FROM tenant_roles tr
             WHERE tr.tenant_id = $1 AND tr.id = $3
             ON CONFLICT (tenant_id, user_id) DO UPDATE SET
                 role_id = EXCLUDED.role_id,
                 status = EXCLUDED.status
             RETURNING tenant_id, user_id`,
            [input.tenantId, input.userId, input.roleId, status],
        );
        if (!result.rows[0]) throw new Error("Tenant role was not found");

        const member = await this.getMember(input.tenantId, input.userId);
        if (!member) throw new Error("Tenant member creation did not return a record");
        return member;
    }
}

function mapTenant(row: Record<string, unknown>): TenantRecord {
    return {
        id: stringValue(row.id),
        slug: stringValue(row.slug),
        name: stringValue(row.name),
        status: tenantStatusValue(row.status),
        ownerUserId: optionalString(row.owner_user_id),
        settings: recordValue(row.settings),
        createdAt: isoValue(row.created_at),
        updatedAt: isoValue(row.updated_at),
    };
}

function mapTenantMember(row: Record<string, unknown>): TenantMemberRecord {
    return {
        tenantId: stringValue(row.tenant_id),
        userId: stringValue(row.user_id),
        roleId: stringValue(row.role_id),
        roleKey: stringValue(row.role_key),
        status: tenantMemberStatusValue(row.status),
        permissions: stringArrayValue(row.permissions),
        joinedAt: isoValue(row.joined_at),
        updatedAt: isoValue(row.updated_at),
    };
}

function tenantStatusValue(value: unknown): TenantStatus {
    return value === "disabled" ? "disabled" : "active";
}

function tenantMemberStatusValue(value: unknown): TenantMemberStatus {
    return value === "disabled" ? "disabled" : "active";
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringArrayValue(value: unknown): string[] {
    return Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
}

function requiredText(value: string, label: string) {
    const text = value.trim();
    if (!text) throw new Error(`${label} is required`);
    return text;
}
