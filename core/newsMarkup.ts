// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The little Markdown the changelog is written in, as something a component can render.
//
// Entries are stored exactly as they are published — a bold lead, the occasional link or
// piece of code, blank lines between paragraphs — because the lead is prose and splitting
// it into fields would be rewriting the register it was written in (core/changelog). The
// page has to render that, and the answer is neither a Markdown library nor raw HTML: a
// library is a hundred kilobytes for four constructs, and raw HTML on a page built from a
// file in the repository is an injection waiting for the day somebody pastes a link into
// the changelog. So the text is parsed into parts and the component writes elements.
//
// Deliberately four constructs and no more. Anything else in an entry renders as the
// literal characters, which is the honest failure: a reader sees the asterisks and
// somebody fixes the entry, where a half-supported syntax would silently drop the words.

export type Part =
    | { kind: "text"; text: string }
    | { kind: "bold"; text: string }
    | { kind: "code"; text: string }
    | { kind: "link"; text: string; href: string };

// Only the schemes a browser can safely follow. A "javascript:" href in an entry is not a
// link, and rendering it as one would run whatever it says the moment a reader clicks.
const SAFE_HREF = /^(https?:\/\/|\/|mailto:)/i;

// `[text](href)`, `**bold**`, `` `code` `` — matched together so the first one to start
// wins.
//
// A bold run may not contain a "[", so a link inside bold is found as the link and the
// asterisks around it render as themselves. Neither construct nests here, and of the two
// readings that is the one that still gives a reader something to click.
const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*[]+)\*\*|`([^`]+)`/g;

// One line's parts, in order, with the plain text between them kept.
export function inlineParts(line: string): Part[] {
    const parts: Part[] = [];
    let at = 0;
    for (const match of line.matchAll(INLINE)) {
        const start = match.index;
        if (start > at) {
            parts.push({ kind: "text", text: line.slice(at, start) });
        }
        const [whole, linkText, href, bold, code] = match;
        if (linkText !== undefined && href !== undefined) {
            parts.push(
                SAFE_HREF.test(href)
                    ? { kind: "link", text: linkText, href }
                    : { kind: "text", text: whole },
            );
        } else if (bold !== undefined) {
            parts.push({ kind: "bold", text: bold });
        } else if (code !== undefined) {
            parts.push({ kind: "code", text: code });
        }
        at = start + whole.length;
    }
    if (at < line.length) {
        parts.push({ kind: "text", text: line.slice(at) });
    }
    // Adjacent plain runs folded back together, so what a reader gets is one piece of
    // prose rather than two that happen to sit beside each other — which is what an
    // unfollowable link, rendered as its own characters, leaves behind.
    return parts.reduce<Part[]>((folded, part) => {
        const last = folded[folded.length - 1];
        if (part.kind === "text" && last?.kind === "text") {
            last.text += part.text;
            return folded;
        }
        folded.push(part);
        return folded;
    }, []);
}

// An entry's paragraphs: blank-line separated, each with its own line breaks folded into
// spaces. The entries are written as YAML block scalars wrapped at a column, so a line
// break inside a paragraph is where the author's editor wrapped and not something a
// reader should see.
export function paragraphs(body: string): Part[][] {
    return body
        .split(/\n\s*\n/)
        .map((block) => block.split("\n").join(" ").trim())
        .filter((block) => block !== "")
        .map(inlineParts);
}
