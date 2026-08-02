export const ADMIN_SECTION_KEYS = [
    "overview",
    "site",
    "channels",
    "skills",
    "settings",
    "accountDeletion",
    "mediaStorage",
    "externalStorage",
    "backup",
    "points",
    "wallet",
    "orders",
    "products",
    "promotions",
    "coupons",
    "referrals",
    "payments",
    "updates",
    "cdk",
    "announcements",
    "works",
    "users",
    "logs",
    "generationOperations",
    "prompts",
    "adminHelp",
] as const;

export type AdminSectionKey = (typeof ADMIN_SECTION_KEYS)[number];

const adminSectionKeys = new Set<AdminSectionKey>(ADMIN_SECTION_KEYS);

export function parseAdminSection(value: string | string[] | undefined): AdminSectionKey {
    const section = Array.isArray(value) ? value[0] : value;
    return adminSectionKeys.has(section as AdminSectionKey) ? (section as AdminSectionKey) : "overview";
}

export function adminSectionHref(section: AdminSectionKey, currentHref = "/admin") {
    const url = new URL(currentHref, "http://localhost");
    if (section === "overview") url.searchParams.delete("section");
    else url.searchParams.set("section", section);
    return `${url.pathname}${url.search}${url.hash}`;
}
