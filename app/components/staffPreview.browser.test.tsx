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
        await waitFor(() => expect(container.querySelector("svg")).toBeTruthy(), { timeout: 8000 });
    });
});
