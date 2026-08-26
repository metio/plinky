// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Fragment, type ReactNode } from "react";

// A translated sentence with something clickable inside it.
//
// Paraglide answers a string, so a link cannot simply be interpolated: the value of a
// message parameter is text, and a React element is not. The way round it that keeps
// translation honest is to let the sentence carry a marker where the link goes, and put
// the element back afterwards.
//
// The alternative — splitting the sentence into a before, a link and an after — fixes
// English word order onto twenty-five other languages, which is the exact thing
// translating exists to avoid. German puts the verb last and Japanese puts the particle
// after the noun; a sentence assembled from fragments can only be right in the language
// it was cut up in. Here the translator sees one sentence with `{glossary}` in it and may
// put it wherever their language wants.
//
// The marker is ordinary printable text rather than a control character, so it survives
// a JSON round trip and the tracked-source byte check has nothing to object to.

const MARKER = /(\[\[[a-z-]+\]\])/;

export function slot(name: string): string {
    return `[[${name}]]`;
}

export function LinkedText({
    text,
    links,
}: {
    // The already-translated sentence, with a slot() where each link belongs.
    text: string;
    links: Record<string, ReactNode>;
}) {
    return (
        <>
            {text.split(MARKER).map((part) => {
                const name = /^\[\[([a-z-]+)\]\]$/.exec(part)?.[1];
                const link = name === undefined ? undefined : links[name];
                // A slot with nothing to put in it renders as itself rather than
                // disappearing: a sentence missing a word is harder to notice than one
                // with [[glossary]] sitting in the middle of it. Plain text needs no key,
                // and a link is keyed by its slot name — unique within a sentence, because
                // a sentence has no reason to link the same place twice.
                return link === undefined ? part : <Fragment key={name}>{link}</Fragment>;
            })}
        </>
    );
}
