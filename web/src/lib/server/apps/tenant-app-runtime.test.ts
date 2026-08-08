import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    isAppCenterEnabled: vi.fn(() => true),
    isPostgresDatabaseEnabled: vi.fn(() => true),
    createPostgresTaskBillingService: vi.fn(() => ({ reserve: vi.fn(), settle: vi.fn(), release: vi.fn(), reverse: vi.fn() })),
}));

vi.mock("@/lib/server/tenant/saas-feature", () => ({ isAppCenterEnabled: mocks.isAppCenterEnabled }));
vi.mock("@/lib/server/database", () => ({ createPostgresRepositories: vi.fn(), isPostgresDatabaseEnabled: mocks.isPostgresDatabaseEnabled }));
vi.mock("@/lib/server/billing/task-billing-service", () => ({ createPostgresTaskBillingService: mocks.createPostgresTaskBillingService }));

import { createTenantAppTaskBillingPort } from "./tenant-app-runtime";

describe("tenant app runtime billing boundary", () => {
    it("creates the SaaS task billing port only when the app center and PostgreSQL are enabled", () => {
        const port = createTenantAppTaskBillingPort();
        expect(port).toBe(mocks.createPostgresTaskBillingService.mock.results[0]?.value);
    });

    it("does not expose a legacy fallback when SaaS runtime prerequisites are unavailable", () => {
        mocks.isAppCenterEnabled.mockReturnValueOnce(false);

        expect(() => createTenantAppTaskBillingPort()).toThrowError("Application task billing requires PostgreSQL");
        expect(mocks.createPostgresTaskBillingService).toHaveBeenCalledTimes(1);
    });
});
