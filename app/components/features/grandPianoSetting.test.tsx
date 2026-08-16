// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SampleManifest } from "../../../core/sampledPiano";
import { fakeSampleSource } from "../../adapters/fakeSampleSource";
import { renderWithServices } from "../../testing/renderWithServices";
import { switchOn, toggle } from "../../testing/controls";
import { m } from "../../paraglide/messages.js";
import { GrandPianoSetting } from "./grandPianoSetting";

afterEach(cleanup);

const MANIFEST: SampleManifest = {
    instrument: "Salamander Grand Piano V3",
    author: "Alexander Holm",
    license: "CC-BY-3.0",
    source: "https://example.test",
    version: "v1",
    notes: [],
    releases: [],
};

describe("GrandPianoSetting", () => {
    it("is off until asked for, and turning it on sticks", async () => {
        const samples = fakeSampleSource(null);
        await samples.forget();
        renderWithServices(<GrandPianoSetting />, { samples });
        expect(switchOn(m.settings_grand_piano)).toBe(false);
        toggle(m.settings_grand_piano);
        await waitFor(() => expect(switchOn(m.settings_grand_piano)).toBe(true));
    });

    it("credits the recordings whenever they are being used", () => {
        renderWithServices(<GrandPianoSetting />, { samples: fakeSampleSource(MANIFEST) });
        // CC-BY is a condition, not a courtesy: the credit is on screen wherever the
        // instrument is.
        expect(
            screen.getByText("Salamander Grand Piano V3 by Alexander Holm · CC-BY-3.0"),
        ).toBeTruthy();
    });

    it("says the instrument is on its way before its manifest has landed", async () => {
        const samples = fakeSampleSource(null);
        await samples.enable();
        renderWithServices(<GrandPianoSetting />, { samples });
        expect(screen.getByText(m.settings_grand_piano_arriving())).toBeTruthy();
    });

    it("says nothing about storage until something has been fetched", () => {
        renderWithServices(<GrandPianoSetting />, { samples: fakeSampleSource(MANIFEST) });
        expect(screen.queryByText(/MB/)).toBeNull();
    });
});
