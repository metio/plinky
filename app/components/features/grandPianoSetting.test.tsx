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

    it("says the instrument is on its way only while it is actually on its way", async () => {
        // The bug this pins: on a revisit the choice is remembered and the manifest is not
        // here, and the panel sat saying "fetching" over work nobody had started. The line
        // follows the fetch, not the absence.
        const samples = fakeSampleSource(null);
        await samples.enable();
        renderWithServices(<GrandPianoSetting />, { samples });
        expect(screen.queryByText(m.settings_grand_piano_arriving())).toBeNull();
        expect(screen.getByText(m.settings_grand_piano_offline())).toBeTruthy();
    });

    it("counts what the device holds, in the words that fit the number", () => {
        const samples = fakeSampleSource(MANIFEST);
        samples.put("C4v8.opus");
        renderWithServices(<GrandPianoSetting />, { samples });
        expect(screen.getByText(/\b1 recording on this device/)).toBeTruthy();
        cleanup();

        const more = fakeSampleSource(MANIFEST);
        more.put("C4v8.opus");
        more.put("C4v12.opus");
        renderWithServices(<GrandPianoSetting />, { samples: more });
        expect(screen.getByText(/\b2 recordings on this device/)).toBeTruthy();
    });

    it("says nothing about storage until something has been fetched", () => {
        renderWithServices(<GrandPianoSetting />, { samples: fakeSampleSource(MANIFEST) });
        // The switch's own caption ends "kept on this device", so the count is what is
        // being looked for rather than the phrase.
        expect(screen.queryByText(/\d+ recordings? on this device/)).toBeNull();
    });
});
