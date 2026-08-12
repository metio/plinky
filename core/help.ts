// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Splits a help section's text into paragraphs on blank lines, dropping any that
// are empty. The page renders each as a text node, never as markup — the text is
// ours, written in the message catalogue alongside every other string, so there
// is nothing to sanitise and nothing to parse.
export function paragraphs(text: string): string[] {
    return text
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}
