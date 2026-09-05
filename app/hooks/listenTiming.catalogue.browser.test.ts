// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { decompressMxl } from "../../core/musicxmlFile";
import { readScoreMarks } from "../../core/musicxmlMarks";
import { collectListenSteps } from "../lib/listenSteps";
import { collectKeepUpSteps } from "./useKeepUp";

// The sounding walks against the printed page, on real scores nobody wrote for this test.
//
// Listen and Keep up render sound, and a wrong rendering has no observer in CI: every
// gate is silent. The one thing that can be checked without an ear is that the clock
// each walk keeps agrees with where the notes are printed — that between two positions
// the page runs straight through, the walk dwells exactly the printed distance. That is
// the invariant that was broken, unnoticed, for every piece where one voice moves on
// inside the other's note: two in three of the catalogue. The fakes could not see it,
// because a fake puts its positions where the rule expects them.

// Enough real scores to mean something; the walk takes what it needs from a spread
// across the manifest, since some of the catalogue the engraver cannot lay out.
const WANTED = 12;
const SAMPLE = 48;

type Entry = { id: string; title: string; license: string };

let host: HTMLDivElement | null = null;

afterEach(() => {
    host?.remove();
    host = null;
});

async function xmlFor(entry: Entry): Promise<string | null> {
    const response = await fetch(`/songs/${entry.license.toLowerCase()}/${entry.id}.mxl`);
    if (!response.ok) {
        return null;
    }
    return decompressMxl(new Uint8Array(await response.arrayBuffer()));
}

async function engrave(xml: string): Promise<OpenSheetMusicDisplay> {
    host = document.createElement("div");
    host.style.width = "900px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    await osmd.load(xml);
    osmd.render();
    return osmd;
}

// A hundred-and-twentieth of a crotchet: finer than notation, coarser than float noise.
const EPSILON = 1 / 120;

// Where the walk's clock parts from the page: for each pair of positions the page runs
// straight through, the dwell between them against the printed distance, in quarters.
function driftOf(
    steps: readonly { whole: number; lengths: number[]; advancesCursor: boolean }[],
): string[] {
    const drift: string[] = [];
    let dwelt = 0;
    let from: number | null = null;
    for (const step of steps) {
        if (from === null) {
            from = step.whole;
        }
        dwelt += Math.min(...step.lengths);
        if (!step.advancesCursor) {
            continue;
        }
        const next = steps.find(
            (one) =>
                one.whole !== step.whole &&
                one.advancesCursor &&
                steps.indexOf(one) > steps.indexOf(step),
        );
        const printed = next === undefined ? null : (next.whole - from) * 4;
        // A jump back is a repeat, and a gap the shortest length cannot cover is one
        // too: the page says nothing about time across either, so the clock re-anchors.
        if (printed !== null && printed > 0 && printed <= dwelt + EPSILON) {
            if (Math.abs(printed - dwelt) > EPSILON) {
                drift.push(
                    `at ${from.toFixed(4)}: dwelt ${dwelt.toFixed(4)}, printed ${printed.toFixed(4)}`,
                );
            }
        }
        from = null;
        dwelt = 0;
    }
    return drift;
}

describe("the sounding walks on the real catalogue", () => {
    it("keep the printed time between positions, on scores nobody wrote for this test", async () => {
        const manifest: Entry[] = await (await fetch("/songs/manifest.json")).json();
        const stride = Math.max(1, Math.floor(manifest.length / SAMPLE));
        const spread = manifest.filter((_, index) => index % stride === 0);
        const failures: string[] = [];
        let compared = 0;
        for (const entry of spread) {
            if (compared >= WANTED) {
                break;
            }
            const xml = await xmlFor(entry);
            if (!xml) {
                continue;
            }
            let osmd: OpenSheetMusicDisplay;
            try {
                osmd = await engrave(xml);
            } catch {
                // A piece the engraver cannot lay out is the differential test's finding,
                // not this one's.
                host?.remove();
                host = null;
                continue;
            }
            const marks = readScoreMarks(new DOMParser().parseFromString(xml, "application/xml"));
            const listen = driftOf(collectListenSteps(osmd, marks));
            const keepUp = driftOf(collectKeepUpSteps(osmd, "both"));
            host?.remove();
            host = null;
            compared += 1;
            for (const [name, drift] of [
                ["Listen", listen],
                ["Keep up", keepUp],
            ] as const) {
                if (drift.length > 0) {
                    failures.push(
                        `${entry.id} (${entry.title}) ${name} parts from the page at ${drift.length} of its positions:\n    ${drift.slice(0, 4).join("\n    ")}`,
                    );
                }
            }
        }
        expect(compared).toBeGreaterThanOrEqual(WANTED);
        expect(failures, failures.join("\n")).toEqual([]);
    }, 600_000);
});
