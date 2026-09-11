// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export const LICENSES: readonly string[];
export function section(body: string, label: string): string;
export function readSubmission(body: string): { xml: string; license: string };
export function checkLicense(raw: string): string | null;
export function xmlProblem(xml: string): string | null;
export function licenseProblem(license: string): string | null;
export function renderReport(result: {
    problems: readonly string[];
    notes: number;
    license: string | null;
}): string;
export function submissionOutputs(verdict: { valid: unknown; report: string }): {
    valid: "true" | "false";
    report: string;
};
export function formatFileCommand(outputs: Record<string, string>, delimiter: string): string;
export function parseFileCommand(text: string): Array<[string, string]>;
