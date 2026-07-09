// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A well-formed https URL is the one shape safe to drop into an <img src> or an
// <a href> from editor-supplied content: it rules out http, data:, javascript:,
// and anything unparsable. Shared by every content source that renders a picture
// or a link a non-technical editor typed (the news banner, the help page).
export function isHttpsUrl(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}
