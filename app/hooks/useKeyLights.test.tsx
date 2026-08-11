// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NOTHING_LIT, type UpcomingPosition } from "../../core/keyLights";
import { fakeKeyLights } from "../adapters/fakeKeyLights";
import { useKeyLights } from "./useKeyLights";

afterEach(cleanup);

const HERE: UpcomingPosition = { pitches: [60], pitchStaves: [0] };
const NEXT: UpcomingPosition = { pitches: [62], pitchStaves: [0] };
const LEFT: UpcomingPosition = { pitches: [48], pitchStaves: [1] };

type Options = Parameters<typeof useKeyLights>[0];

function mount(overrides: Partial<Options> = {}) {
    const lights = fakeKeyLights();
    const base: Options = {
        lights,
        enabled: true,
        practicing: true,
        hints: "always",
        missedHere: false,
        upcoming: [HERE, NEXT],
        ...overrides,
    };
    const view = renderHook((options: Options) => useKeyLights(options), {
        initialProps: base,
    });
    return { lights, view, base };
}

describe("useKeyLights", () => {
    it("lights the position the run is on", () => {
        const { lights } = mount();
        expect(lights.lit()).toEqual({ left: [], right: [60] });
    });

    it("lights one position, not the whole look-ahead", () => {
        // Two indistinguishable lights with nothing to say which comes first would be
        // worse than one.
        const { lights } = mount();
        expect(lights.lit().right).not.toContain(62);
    });

    it("moves the light on as the run advances", () => {
        const { lights, view, base } = mount();
        view.rerender({ ...base, upcoming: [NEXT] });
        expect(lights.lit()).toEqual({ left: [], right: [62] });
    });

    it("puts a left-hand position on the left hand", () => {
        const { lights } = mount({ upcoming: [LEFT] });
        expect(lights.lit()).toEqual({ left: [48], right: [] });
    });

    it("shows nothing when the player has not asked for it", () => {
        const { lights } = mount({ enabled: false });
        expect(lights.lit()).toEqual(NOTHING_LIT);
    });

    it("shows nothing between runs — the instrument is theirs", () => {
        const { lights } = mount({ practicing: false });
        expect(lights.lit()).toEqual(NOTHING_LIT);
    });

    it("goes dark the moment the run ends", () => {
        const { lights, view, base } = mount();
        expect(lights.lit().right).toEqual([60]);
        view.rerender({ ...base, practicing: false });
        expect(lights.lit()).toEqual(NOTHING_LIT);
    });

    it("obeys the reading-aid policy rather than a switch of its own", () => {
        expect(mount({ hints: "never" }).lights.lit()).toEqual(NOTHING_LIT);
        // A sight-read arrives here as "never", which is why it needs no second check.
        expect(mount({ hints: "miss", missedHere: false }).lights.lit()).toEqual(NOTHING_LIT);
        expect(mount({ hints: "miss", missedHere: true }).lights.lit()).toEqual({
            left: [],
            right: [60],
        });
    });

    it("lights up when a slip earns the hint, and goes back to dark at the next position", () => {
        const { lights, view, base } = mount({ hints: "miss" });
        expect(lights.lit()).toEqual(NOTHING_LIT);
        view.rerender({ ...base, hints: "miss", missedHere: true });
        expect(lights.lit()).toEqual({ left: [], right: [60] });
        view.rerender({ ...base, hints: "miss", missedHere: false, upcoming: [NEXT] });
        expect(lights.lit()).toEqual(NOTHING_LIT);
    });

    it("says nothing twice for a picture that has not changed", () => {
        const { lights, view, base } = mount();
        const before = lights.sent().length;
        // A re-render for some unrelated reason must not re-send the same picture.
        view.rerender({ ...base });
        expect(lights.sent()).toHaveLength(before);
    });

    it("puts the lights out when it goes away", () => {
        const { lights, view } = mount();
        expect(lights.lit().right).toEqual([60]);
        view.unmount();
        // A light outlives the page that lit it, so nothing may leave one behind.
        expect(lights.lit()).toEqual(NOTHING_LIT);
    });
});

describe("a chord across the grand staff", () => {
    it("lights each hand's own note, not every note on both", () => {
        // The step model carries a staff per pitch, so the instrument's two channels —
        // different colours on a Casio — say which hand plays which key.
        const { lights } = mount({
            upcoming: [{ pitches: [48, 60, 64], pitchStaves: [1, 0, 0] }],
        });
        expect(lights.lit()).toEqual({ left: [48], right: [60, 64] });
    });
});
