import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

describe("deployment repository ownership", () => {
    it("uses the 18783405337 repository and GHCR images everywhere deployment depends on", () => {
        const files = [
            ".github/workflows/docker-image.yml",
            ".github/workflows/docs-docker-image.yml",
            "docker-compose.yml",
            "docker-compose.baota.yml",
            "docker-compose.external-db.yml",
            "docker-compose.lowmem.yml",
            ".env.example",
            "web/src/hooks/use-version-check.ts",
            "web/src/components/layout/github-link.tsx",
            "web/src/components/admin/admin-update-center.tsx",
            "web/src/app/install/database-config.ts",
            "web/scripts/compose-contract.mjs",
        ];
        for (const file of files) {
            const source = read(file);
            expect(source, file).not.toContain("csyqlz/VOZEB-PRO");
            expect(source, file).not.toContain("ghcr.io/csyqlz/");
        }
        expect(read(".github/workflows/docker-image.yml")).toContain("ghcr.io/18783405337/vozeb-pro");
        expect(read("docker-compose.baota.yml")).toContain("ghcr.io/18783405337/vozeb-pro:v0.0.6");
        expect(read("VERSION").trim()).toBe("v0.0.6");
    });
});
