// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import type { SampleManifest } from "../../../core/sampledPiano";
import { fakeSampleSource } from "../../adapters/fakeSampleSource";
import { memoryStore } from "../../adapters/memoryStore";
import { createServices, ServicesProvider } from "../../contexts/services";
import type { SampleSource } from "../../ports/sampleSource";
import { renderWithServices } from "../../testing/renderWithServices";
import { switchOn, toggle } from "../../testing/controls";
import { m } from "../../paraglide/messages.js";
import { GrandPianoSetting } from "./grandPianoSetting";

afterEach(cleanup);

const region = (file: string) => ({
    file,
    keyCentre: 60,
    lowKey: 59,
    highKey: 61,
    lowVelocity: 1,
    highVelocity: 127,
});

const MANIFEST: SampleManifest = {
    instrument: "Salamander Grand Piano V3",
    author: "Alexander Holm",
    license: "CC-BY-3.0",
    source: "https://example.test",
    version: "v1",
    notes: [region("C4v8.opus"), region("C4v12.opus")],
    releases: [{ ...region("C4rel.opus"), kind: "knock" as const }],
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

    it("counts what the device holds against what the pack has", () => {
        // The figure a player can act on is the fraction. "1 recording" alone says nothing
        // about whether the instrument is nearly here or has barely started, which is the
        // question somebody who cannot hear the difference is actually asking.
        const samples = fakeSampleSource(MANIFEST);
        samples.put("C4v8.opus");
        renderWithServices(<GrandPianoSetting />, { samples });
        expect(
            screen.getByText(m.settings_grand_piano_of_pack({ held: 1, total: 3 })),
        ).toBeTruthy();
    });

    it("fetches the whole pack on request", async () => {
        const samples = fakeSampleSource(MANIFEST);
        renderWithServices(<GrandPianoSetting />, { samples });
        expect(
            screen.getByText(m.settings_grand_piano_of_pack({ held: 0, total: 3 })),
        ).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: m.settings_grand_piano_fetch_all() }));
        await waitFor(() =>
            expect(
                screen.getByText(m.settings_grand_piano_of_pack({ held: 3, total: 3 })),
            ).toBeTruthy(),
        );
    });

    it("gives the space back without giving up the instrument", async () => {
        // Deleting the recordings is not the same act as turning the recorded piano off:
        // the switch stays on and they arrive again with the next piece. Two buttons,
        // because a player reclaiming a gigabyte is not asking to go back to the synth.
        const samples = fakeSampleSource(MANIFEST);
        samples.put("C4v8.opus");
        renderWithServices(<GrandPianoSetting />, { samples });
        fireEvent.click(screen.getByRole("button", { name: m.settings_grand_piano_clear() }));
        fireEvent.click(screen.getByRole("button", { name: m.settings_grand_piano_clear_yes() }));
        await waitFor(() =>
            expect(
                screen.getByText(m.settings_grand_piano_of_pack({ held: 0, total: 3 })),
            ).toBeTruthy(),
        );
        expect(switchOn(m.settings_grand_piano)).toBe(true);
    });
});

describe("GrandPianoSetting, prerendered", () => {
    // The prerender writes one document that every device opens, and the machine writing
    // it runs a sample source of its own: give it a manifest and the credit line, the
    // pack total and the button's label all become that machine's, which no first paint
    // anywhere can match. React throws a hydration mismatch and discards the whole tree —
    // on the live site this was one uncaught error per Settings load.
    const hydrationErrors = async (built: SampleSource, opening: SampleSource) => {
        const html = renderToString(
            <ServicesProvider services={createServices({ store: memoryStore(), samples: built })}>
                <GrandPianoSetting />
            </ServicesProvider>,
        );
        const container = document.createElement("div");
        container.innerHTML = html;
        document.body.append(container);
        const complaints: string[] = [];
        await act(async () => {
            hydrateRoot(
                container,
                <ServicesProvider
                    services={createServices({ store: memoryStore(), samples: opening })}
                >
                    <GrandPianoSetting />
                </ServicesProvider>,
                { onRecoverableError: (error) => complaints.push(String(error)) },
            );
        });
        return { html, complaints };
    };

    it("says nothing the machine that built it happened to have fetched", async () => {
        const { html } = await hydrationErrors(fakeSampleSource(MANIFEST), fakeSampleSource(null));
        expect(html).not.toContain(MANIFEST.instrument);
        expect(html).toContain(m.settings_grand_piano_offline());
    });

    it("hydrates on a device that has fetched nothing", async () => {
        const { complaints } = await hydrationErrors(
            fakeSampleSource(MANIFEST),
            fakeSampleSource(null),
        );
        expect(complaints).toEqual([]);
    });

    it("hydrates on a device that already holds the pack", async () => {
        const held = fakeSampleSource(MANIFEST);
        held.put("C4v8.opus");
        const { complaints } = await hydrationErrors(fakeSampleSource(null), held);
        expect(complaints).toEqual([]);
    });
});
