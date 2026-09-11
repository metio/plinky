// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/singular-copies.mjs. The module stays plain JavaScript because
// dev/check-messages.mjs runs through bare `node` in its own CI job.

// Per locale, the messages that read the same for one and many, each with its reason.
export type SameForOneAndMany = Record<string, Record<string, string>>;

// One line per counted message whose singular was copied from its plural, and per
// exemption that no longer describes any message. Empty when the locale is sound.
export function singularCopies(
    locale: string,
    messages: Record<string, unknown>,
    exemptions?: SameForOneAndMany,
): string[];
