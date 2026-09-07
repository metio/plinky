// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export const FILE_LIMIT: number;
export const FILE_MARGIN: number;
export function countFiles(dir: string): number;
export function checkDeployFiles(dir?: string, limit?: number, margin?: number): number;
