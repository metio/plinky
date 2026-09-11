// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/plural-messages.mjs. The module stays plain JavaScript because
// dev/check-messages.mjs runs through bare `node` in its own CI job.

// Whether a catalogue value is the message-format plugin's plural form.
export function isComplex(value: unknown): boolean;

// The text of every arm of a plural message, or the plain string alone.
export function armsOf(value: unknown): string[];

// One line per plural message missing an arm its locale needs, and per message the contract
// counts that this locale writes as one plain string. Empty when the locale is sound.
export function pluralProblems(
    locale: string,
    messages: Record<string, unknown>,
    contract?: Record<string, unknown>,
): string[];
