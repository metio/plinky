// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";

// Verifies the follow-cursor + bounded-scroll-box setup the ScoreViewer uses: as the
// cursor advances down a tall piece, OSMD scrolls the box so the cursor stays in view —
// the mechanism that lets a phone follow a multi-line piece without manual scrolling.

const ATTRS =
    "<attributes><divisions>1</divisions><key><fifths>0</fifths></key>" +
    "<time><beats>4</beats><beat-type>4</beat-type></time>" +
    "<clef><sign>G</sign><line>2</line></clef></attributes>";
const bar = (n: number) =>
    `<measure number="${n}">${n === 1 ? ATTRS : ""}` +
    "<note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><type>whole</type></note></measure>";
const TALL =
    '<?xml version="1.0"?><score-partwise version="3.1"><part-list>' +
    '<score-part id="P1"><part-name>M</part-name></score-part></part-list>' +
    `<part id="P1">${Array.from({ length: 24 }, (_, i) => bar(i + 1)).join("")}</part></score-partwise>`;

let host: HTMLDivElement | undefined;
afterEach(() => {
    host?.remove();
    host = undefined;
});

describe("follow-cursor auto-scroll", () => {
    it("scrolls a tall piece's box to keep the advancing cursor in view", async () => {
        // A narrow, short box forces many systems and a real scroll overflow.
        host = document.createElement("div");
        host.style.width = "240px";
        host.style.height = "120px";
        host.style.overflow = "auto";
        document.body.appendChild(host);

        const osmd = new OpenSheetMusicDisplay(host, {
            drawingParameters: "compact",
            followCursor: true,
        });
        await osmd.load(TALL);
        osmd.render();
        osmd.cursor.show();
        osmd.cursor.reset();
        expect(host.scrollTop).toBe(0);

        // Walk the cursor well down the piece; follow-cursor scrolls the box to it.
        for (let i = 0; i < 20; i++) {
            osmd.cursor.next();
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(host.scrollTop).toBeGreaterThan(0);
        osmd.clear();
    });
});
