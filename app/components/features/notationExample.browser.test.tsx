// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { entryById, GLOSSARY } from "../../../core/glossary";
import { buildSnippet } from "../../../core/glossaryScore";

// Whether the glossary's MusicXML is real MusicXML.
//
// Nothing in the node suite can answer that: it asserts on the text we emit, which is
// only ever a description of what we meant. The engine is the authority, and it only
// runs in a browser — so every example is loaded into it here. A missing child, an
// element in the wrong order, an empty <notations/>: the loader rejects, and the entry
// that broke is named.
//
// Every example goes through one engine instance rather than one each, and only the two
// checks that need a picture lay one out. Building an OpenSheetMusicDisplay and running
// its layout are the expensive parts, and this project's Gecko instance already sits
// close to its timeout on OSMD work.

// A missing entry means the catalogue changed under the test; failing loudly beats
// quietly measuring some other symbol instead.
function must(id: string) {
    const entry = entryById(id);
    if (!entry) {
        throw new Error(`no glossary entry called ${id}`);
    }
    return entry;
}

let host: HTMLDivElement | undefined;

function open(): OpenSheetMusicDisplay {
    host = document.createElement("div");
    host.style.width = "600px";
    document.body.appendChild(host);
    return new OpenSheetMusicDisplay(host, {
        autoResize: false,
        drawingParameters: "compact",
        drawTitle: false,
        drawPartNames: false,
    });
}

afterEach(() => {
    host?.remove();
    host = undefined;
});

// How much ink an example put on the page. A file the engine parsed but found no music
// in leaves an all-but-empty canvas, so this separates "drew it" from "accepted it".
function paths(): number {
    return host?.querySelector("svg")?.querySelectorAll("path").length ?? 0;
}

describe("the glossary's examples", () => {
    // Whether the engine accepts a MusicXML file is a property of the file and the
    // engine, not of the browser around them — so the sweep over every example runs
    // once, on Chromium. Gecko is the slower of this project's two browsers and its
    // OSMD tests already sit close to the timeout; a dozen more loads there would buy
    // no signal and starve unrelated tests. The rendering checks below still run on both.
    it.skipIf(navigator.userAgent.includes("Firefox"))(
        "are all MusicXML the engine accepts",
        async () => {
            const display = open();

            for (const entry of GLOSSARY) {
                // A rejected load throws, and the id in the message names the culprit.
                await display.load(buildSnippet(entry.shown)).catch((error: unknown) => {
                    throw new Error(`${entry.id}: ${String(error)}`);
                });
            }
        },
    );

    it("draw at a readable size", async () => {
        // Nobody sees these renders in review, so the shape is asserted instead: a
        // one-bar example that came out a few pixels tall, or wider than its column, is
        // a layout fault that "it drew something" would not notice.
        const display = open();
        await display.load(buildSnippet(must("dotted").shown));
        display.render();
        const box = host?.querySelector("svg")?.getBoundingClientRect();

        expect(box?.height ?? 0).toBeGreaterThan(40);
        expect(box?.height ?? 0).toBeLessThan(400);
        expect(box?.width ?? 0).toBeLessThanOrEqual(600);
    });

    it("draw the marks they are about", async () => {
        // The staccato example exists to show a dot over a notehead. If the engine drew
        // the notes but silently dropped the articulation, the entry would be a picture
        // of four plain quarter notes with a caption claiming otherwise — so the marked
        // reading has to put more on the page than the same phrase unmarked.
        const staccato = must("staccato");
        const display = open();

        await display.load(buildSnippet(staccato.shown));
        display.render();
        const marked = paths();

        await display.load(buildSnippet(staccato.plain ?? staccato.shown));
        display.render();

        expect(marked).toBeGreaterThan(paths());
    });
});
