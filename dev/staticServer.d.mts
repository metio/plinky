// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Server } from "node:http";

export const MIME_TYPES: Record<string, string>;

export function resolveFile(root: string, path: string): string | null;

export function serveStatic(
    root: string,
    options?: {
        fallback?: "404" | "spa";
        onFallback?: (path: string) => void;
        port?: number;
        host?: string;
    },
): Promise<{ server: Server; port: number; close: () => Promise<void> }>;
