import type { AgentSkill } from "./auth/store-types";

export type AgentSkillImportCandidate = {
    path: string;
    name: string;
};

export type ImportedAgentSkill = AgentSkill & {
    repository: string;
    sourcePath: string;
    sourceCommit: string;
    sourceContentHash: string;
    license?: string;
};

export type AgentSkillImportResult = {
    repository: string;
    ref: string;
    candidates: AgentSkillImportCandidate[];
    skill?: ImportedAgentSkill;
};
