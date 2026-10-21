export type Confidence = "guaranteed" | "conditional" | "observed";
export type RulesSource = "bundled" | "downloaded";
export interface EmailAnalysis { original: string; canonical: string; provider: string | null; rulesApplied: string[]; }
export interface RulesInfo { version: string; schemaVersion: number; source: RulesSource; }
export interface UpdateRulesResult { previousVersion: string; version: string; updated: boolean; path: string; }
export declare function canonEmail(email: string): string;
export declare function analyzeEmail(email: string): EmailAnalysis;
export declare function rulesVersion(): string;
export declare function rulesInfo(): RulesInfo;
export declare function clearRulesCache(): void;
export declare function validateRules(data: unknown): void;
export declare function updateRules(url?: string, options?: { timeoutMs?: number }): Promise<UpdateRulesResult>;
