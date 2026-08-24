// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reading values out of a MusicXML document, for the readers that walk it by tag name.
//
// These are deliberately getElementsByTagName rather than querySelector. A MusicXML tag can
// be a name a CSS selector cannot express without escaping, and the readers only ever want
// the first child of a given tag — the plain DOM call says that and cannot be tripped by a
// name. core/musicxmlParse.ts keeps its own selector-shaped reader, which answers a
// different question and returns null rather than an empty string for a missing value.

// An element's trimmed text, or the empty string when it is missing. Missing and empty are
// the same thing to every caller here: MusicXML omits what does not apply.
export const text = (element: Element | null | undefined): string =>
    element?.textContent?.trim() ?? "";

// The first child of a given tag name.
export const child = (parent: Element, name: string): Element | null =>
    parent.getElementsByTagName(name)[0] ?? null;

// An element's text as a number, falling back when it is missing or unreadable. A file that
// writes nonsense in a <duration> should play the piece, not stop it.
export const numberOf = (element: Element | null | undefined, fallback: number): number => {
    const value = Number(text(element));
    return Number.isFinite(value) ? value : fallback;
};

// The trimmed text of a named child, in one step — the shape the incipit reader wants.
export const textOf = (parent: Element, name: string): string => text(child(parent, name));
