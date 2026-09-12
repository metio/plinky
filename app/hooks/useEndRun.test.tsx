// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type EndRunOptions, useEndRun } from "./useEndRun";

// Every step records its own name, so a test can assert the sequence rather than just
// that each part was told to stop.
function harness({ playing = true }: { playing?: boolean } = {}) {
    const order: string[] = [];
    // Whether each ringOut-taking step was told to let the notes ring.
    const rang: Record<string, boolean> = {};
    // Stopping a part is what ends its playing, as it does on the surface.
    let stillPlaying = playing;
    const step = (name: string) => () => {
        order.push(name);
        stillPlaying = false;
    };
    const ringing =
        (name: string) =>
        ({ ringOut }: { ringOut: boolean }) => {
            order.push(name);
            rang[name] = ringOut;
            stillPlaying = false;
        };
    const options: EndRunOptions = {
        active: true,
        stillPlaying: () => stillPlaying,
        stopListen: step("stopListen"),
        gradeOwedRun: step("gradeOwedRun"),
        saveOwedTake: step("saveOwedTake"),
        stopKeepUp: step("stopKeepUp"),
        stopSelfPaced: ringing("stopSelfPaced"),
        cancelPendingStart: step("cancelPendingStart"),
        restoreScore: step("restoreScore"),
        silence: ringing("silence"),
    };
    const view = renderHook((props: EndRunOptions) => useEndRun(props), {
        initialProps: options,
    });
    return {
        ...view,
        order,
        rang,
        options,
        end: () => view.rerender({ ...options, active: false }),
    };
}

describe("useEndRun", () => {
    it("does nothing while the surface is live", () => {
        const { order } = harness();
        expect(order).toEqual([]);
    });

    it("ends every part of the run when the surface goes quiet", () => {
        const { end, order } = harness();
        end();
        expect(order).toEqual([
            "stopListen",
            // Grading first: the take reads the grade at save time, so a run still
            // owed one has to earn it before the take is written.
            "gradeOwedRun",
            "saveOwedTake",
            "stopKeepUp",
            "stopSelfPaced",
            "cancelPendingStart",
            "restoreScore",
            "silence",
        ]);
    });

    it("takes the owed recording before stopping the self-paced run", () => {
        // The deferred save waits on the run being complete, and stopping the matcher
        // clears exactly that — so a player who stepped out still holding the final
        // note would lose the recording if these two swapped.
        const { end, order } = harness();
        end();
        expect(order.indexOf("saveOwedTake")).toBeLessThan(order.indexOf("stopSelfPaced"));
    });

    it("cancels a start that is already on its way", () => {
        // A sight-read counts down before its run begins; nothing else here stops it,
        // so it would otherwise resolve onto a surface the player had left.
        const { end, order } = harness();
        end();
        expect(order).toContain("cancelPendingStart");
    });

    it("ends the run once, not on every later render", () => {
        const { end, order } = harness();
        end();
        end();
        end();
        expect(order.filter((name) => name === "stopSelfPaced")).toHaveLength(1);
    });

    it("ends it again when a new run is left in turn", () => {
        const { end, order, rerender, options } = harness();
        end();
        rerender({ ...options, active: true });
        end();
        expect(order.filter((name) => name === "stopSelfPaced")).toHaveLength(2);
    });

    it("silences the audio engine on unmount", () => {
        // Its voices are a module singleton and outlive this component, so navigating
        // away has to silence them — the surface never goes quiet on that path.
        const { order, unmount } = harness();
        expect(order).toEqual([]);
        unmount();
        expect(order).toEqual(["silence"]);
    });

    it("cuts everything off when something was still playing", () => {
        const { end, rang } = harness({ playing: true });
        end();
        expect(rang).toEqual({ stopSelfPaced: false, silence: false });
    });

    it("lets the last notes ring when the run had played to its end", () => {
        const { end, rang } = harness({ playing: false });
        end();
        expect(rang).toEqual({ stopSelfPaced: true, silence: true });
    });

    it("asks what was playing before stopping any of it", () => {
        // Stopping Listen first makes "still playing" false; read after it, every
        // interrupted run would pass for one that had finished.
        const { end, rang } = harness({ playing: true });
        end();
        expect(rang.silence).toBe(false);
    });

    it("cuts everything off on unmount, however the run stood", () => {
        const { unmount, rang } = harness({ playing: false });
        unmount();
        expect(rang).toEqual({ silence: false });
    });
});
