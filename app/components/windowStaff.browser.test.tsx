// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WINDOW_COLOR } from "../lib/scoreColor";
import { WindowStaff } from "./windowStaff";

afterEach(cleanup);

const ATTRS =
    "<attributes><divisions>1</divisions><key><fifths>0</fifths></key>" +
    "<time><beats>4</beats><beat-type>4</beat-type></time>" +
    "<clef><sign>G</sign><line>2</line></clef></attributes>";
const bar = (n: number, step: string) =>
    `<measure number="${n}">${n === 1 ? ATTRS : ""}` +
    `<note><pitch><step>${step}</step><octave>4</octave></pitch>` +
    "<duration>4</duration><type>whole</type></note></measure>";
const PIECE =
    '<?xml version="1.0"?><score-partwise version="3.1"><part-list>' +
    '<score-part id="P1"><part-name>Music</part-name></score-part></part-list>' +
    `<part id="P1">${bar(1, "C")}${bar(2, "D")}${bar(3, "E")}${bar(4, "F")}</part></score-partwise>`;

describe("WindowStaff", () => {
    it("paints the active window's bars with the highlight colour", async () => {
        // OSMD only renders in a real browser; the window covers bars 1–2 of four.
        const { container } = render(<WindowStaff xml={PIECE} from={0} to={2} label="piece" />);
        await waitFor(() => expect(container.querySelector("svg")).toBeTruthy(), {
            timeout: 30000,
        });
        await waitFor(
            () =>
                expect(
                    container.querySelectorAll(`[fill="${WINDOW_COLOR}"]`).length,
                ).toBeGreaterThan(0),
            { timeout: 30000 },
        );
    });
});
