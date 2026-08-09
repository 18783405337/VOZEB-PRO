export const PLATFORM_PERMISSIONS = ["platform.tenants.read", "platform.tenants.manage", "platform.tenants.domains.read", "platform.tenants.domains.manage", "platform.apps.publish", "platform.billing.read", "platform.billing.manage", "platform.settings.manage"] as const;

export const TENANT_PERMISSIONS = ["tenant.members.read", "tenant.members.manage", "tenant.roles.manage", "tenant.domains.read", "tenant.domains.manage", "tenant.settings.read", "tenant.settings.manage", "tenant.apps.read", "tenant.apps.configure", "tenant.billing.read", "tenant.merchants.manage"] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
export type TenantPermission = (typeof TENANT_PERMISSIONS)[number] | `tenant.apps.use.${string}`;
