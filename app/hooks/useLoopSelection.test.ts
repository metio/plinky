// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLoopSelection } from "./useLoopSelection";

// A loop hook wired to a container with no SVG (so the paint effect is a no-op) and a
// fixed bar count. canSelect defaults to true so click-guard tests can override it.
const setup = (measureCount = 8, canSelect = () => true) => {
    // A mutable ref holding a detached div stands in for the score container.
    const containerRef = { current: document.createElement("div") };
    return renderHook(() =>
        useLoopSelection({
            containerRef,
            measureBoxes: () => [],
            measureCount,
            renderVersion: 0,
            canSelect,
        }),
    );
};

describe("useLoopSelection", () => {
    it("starts off, with a one-bar range", () => {
        const { result } = setup();
        expect(result.current.on).toBe(false);
        expect(result.current.from).toBe(1);
        expect(result.current.to).toBe(1);
        expect(result.current.read()).toEqual({ on: false, from: 1, to: 1 });
    });

    it("turning the loop on ranges the whole piece by default", () => {
        const { result } = setup(8);
        act(() => result.current.toggle(true));
        expect(result.current.on).toBe(true);
        expect(result.current.from).toBe(1);
        expect(result.current.to).toBe(8);
        // The live reader reflects the change for the transport.
        expect(result.current.read()).toEqual({ on: true, from: 1, to: 8 });
    });

    it("turning the loop off leaves the range where it was", () => {
        const { result } = setup(8);
        act(() => {
            result.current.toggle(true);
            result.current.setFrom(3);
            result.current.setTo(5);
        });
        act(() => result.current.toggle(false));
        expect(result.current.on).toBe(false);
        expect(result.current.from).toBe(3);
        expect(result.current.to).toBe(5);
    });

    it("whole-song resets the range to the full piece without touching on/off", () => {
        const { result } = setup(12);
        act(() => {
            result.current.toggle(true);
            result.current.setFrom(4);
            result.current.setTo(6);
        });
        act(() => result.current.wholeSong());
        expect(result.current.on).toBe(true);
        expect(result.current.from).toBe(1);
        expect(result.current.to).toBe(12);
    });

    it("reseeds a fresh piece to its whole range with the loop off", () => {
        const { result } = setup(8);
        act(() => {
            result.current.toggle(true);
            result.current.setFrom(2);
            result.current.setTo(3);
        });
        act(() => result.current.reseedWholeSong(20));
        expect(result.current.on).toBe(false);
        expect(result.current.from).toBe(1);
        expect(result.current.to).toBe(20);
    });

    it("ignores a click when the score is not selectable", () => {
        const { result } = setup(8, () => false);
        // Arm it, so this exercises the not-selectable guard rather than the press guard.
        act(() => {
            result.current.arm();
            result.current.selectBarAt(10, 10);
        });
        // No anchor dropped, no range change.
        expect(result.current.on).toBe(false);
        expect(result.current.from).toBe(1);
        expect(result.current.to).toBe(1);
    });

    it("ignores a press-less click, so a retargeted compatibility click builds no loop", () => {
        // canSelect is true, but no arm() precedes the click — the browser compatibility
        // click that lands on the score when the keyboard unmounts has no pointer press.
        const { result } = setup(8);
        act(() => result.current.selectBarAt(10, 10));
        expect(result.current.on).toBe(false);
        expect(result.current.read()).toEqual({ on: false, from: 1, to: 1 });
    });
});
