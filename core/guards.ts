// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Shared type guards for validating untrusted parsed data (imports, stored
// JSON, share links) before its fields are read.

// True for any non-null object, so its properties can be probed as unknowns.
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
