// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { drillToMusicXml } from "../lib/drillStaff";
import { StaffPreview } from "./staffPreview";

afterEach(cleanup);

describe("StaffPreview", () => {
    it("renders a drill — chords and all — to a staff", async () => {
        // OSMD only renders in a real browser; this exercises the chord MusicXML.
        const xml = drillToMusicXml([[60, 64, 67], [62], [64], [65]], "right");
        const { container } = render(<StaffPreview xml={xml} label="drill" />);
        await waitFor(() => expect(container.querySelector("svg")).toBeTruthy(), {
            timeout: 30000,
        });
    });

    it("replaces the staff on a new drill instead of stacking another below", async () => {
        const { container, rerender } = render(
            <StaffPreview xml={drillToMusicXml([[60]], "right")} label="drill" />,
        );
        await waitFor(() => expect(container.querySelectorAll("svg")).toHaveLength(1), {
            timeout: 30000,
        });
        // Switching hand (or asking for a new line) feeds a different drill in.
        rerender(<StaffPreview xml={drillToMusicXml([[48], [50]], "left")} label="drill" />);
        // Give the reload time to draw, then confirm there is still exactly one staff —
        // a fresh OSMD instance per render would leave two stacked.
        await new Promise((resolve) => setTimeout(resolve, 700));
        expect(container.querySelectorAll("svg")).toHaveLength(1);
    });
});
