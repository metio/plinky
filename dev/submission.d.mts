// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export const LICENSES: readonly string[];
export function checkSubmission(
    body: string,
    render: (xml: string) => Promise<{ ok: boolean; count: number }>,
): Promise<string>;
