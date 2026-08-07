export type TenantStatus = "active" | "disabled";
export type TenantDomainKind = "custom" | "subdomain";
export type TenantDomainStatus = "pending" | "verified" | "disabled";
export type TenantMemberStatus = "active" | "disabled";

export type TenantRecord = {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
    ownerUserId?: string;
    settings: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
};

export type TenantDomainRecord = {
    id: string;
    tenantId: string;
    hostname: string;
    kind: TenantDomainKind;
    status: TenantDomainStatus;
    verificationToken: string;
    verifiedAt?: string;
    createdAt: string;
    updatedAt: string;
};

export type TenantMemberRecord = {
    tenantId: string;
    userId: string;
    roleId: string;
    roleKey: string;
    status: TenantMemberStatus;
    permissions: string[];
    joinedAt: string;
    updatedAt: string;
};

export type CreateTenantWithOwnerInput = {
    id?: string;
    slug: string;
    name: string;
    ownerUserId: string;
    ownerRoleId?: string;
    ownerPermissions?: readonly string[];
    settings?: Record<string, unknown>;
};

export type AddTenantMemberInput = {
    tenantId: string;
    userId: string;
    roleId: string;
    status?: TenantMemberStatus;
};
