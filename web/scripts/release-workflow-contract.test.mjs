import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("release workflow contract", () => {
    it.each(["docker-image.yml", "docs-docker-image.yml"])("gates %s behind quality and signs immutable digests", (file) => {
        const source = workflow(file);
        const parsed = parseDocument(source);

        expect(parsed.errors).toEqual([]);
        expect(source).not.toContain('branches: ["main"]');
        expect(source).toContain("quality:");
        expect(source).toMatch(/build:\s+needs:\s+- quality\s+- meta/s);
        expect(source).toContain("type=raw,value=latest,enable=${{ startsWith(github.ref, 'refs/tags/v')");
        expect(source).toContain("anchore/sbom-action@e22c389904149dbc22b58101806040fa8d37a610");
        expect(source).toContain("cosign sign --yes");
        expect(source).toContain("cosign attest --yes");
        expect(source).toContain("version: 11.9.0");
        expect(source).not.toMatch(/uses:\s+[^\s]+@(v\d|main|master)\b/);
    });

    it("runs lint, tests, type-check, build and browser E2E in the main quality workflow", () => {
        const source = workflow("quality.yml");

        expect(parseDocument(source).errors).toEqual([]);
        for (const command of ["pnpm run lint", "pnpm run typecheck", "pnpm test", "pnpm run build", "pnpm run e2e"]) expect(source).toContain(command);
        expect(source).toContain("pnpm exec playwright install --with-deps chromium");
        expect(source).toContain("version: 11.9.0");
        expect(source).toContain("gitleaks/gitleaks-action@dcedce43c6f43de0b836d1fe38946645c9c638dc");
        expect(source).toContain("github/codeql-action/analyze@47be0dbd5113ab1b79fe2dd3f68bdf7e426cdc87");
        expect(source).not.toMatch(/uses:\s+[^\s]+@(v\d|main|master)\b/);
    });

    it("declares one pnpm version for the repository and both Docker builds", () => {
        const rootPackage = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
        const appDockerfile = readFileSync(path.join(repoRoot, "Dockerfile"), "utf8");
        const docsDockerfile = readFileSync(path.join(repoRoot, "docs/Dockerfile"), "utf8");

        expect(rootPackage.packageManager).toBe("pnpm@11.9.0");
        expect(appDockerfile).toContain("ARG PNPM_VERSION=11.9.0");
        expect(docsDockerfile).toContain("pnpm@11.9.0");
    });
});

function workflow(file) {
    return readFileSync(path.join(repoRoot, ".github/workflows", file), "utf8");
}
