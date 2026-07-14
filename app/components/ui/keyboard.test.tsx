// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Keyboard } from "./keyboard";

afterEach(cleanup);

describe("Keyboard", () => {
    it("labels every key in the range", () => {
        render(<Keyboard from={60} to={62} />);
        expect(screen.getByLabelText("C4")).toBeTruthy();
        expect(screen.getByLabelText("C#4")).toBeTruthy();
        expect(screen.getByLabelText("D4")).toBeTruthy();
    });

    it("prints no note names by default", () => {
        render(<Keyboard from={60} to={64} />);
        expect(screen.queryByText("C")).toBeNull();
    });

    it("marks only the C keys in landmark mode", () => {
        render(<Keyboard from={60} to={72} labels="c" />);
        // Two Cs across C4–C5 (60 and 72), and nothing on the other letters.
        expect(screen.getAllByText("C")).toHaveLength(2);
        expect(screen.queryByText("D")).toBeNull();
    });

    it("labels every key when asked", () => {
        render(<Keyboard from={60} to={62} labels="all" />);
        expect(screen.getByText("C")).toBeTruthy();
        expect(screen.getByText("C♯")).toBeTruthy();
        expect(screen.getByText("D")).toBeTruthy();
    });

    it("lights a held key green and highlights the expected one", () => {
        render(<Keyboard from={60} to={67} lit={new Set([60])} expected={[64]} />);
        expect(screen.getByLabelText("C4").className).toContain("bg-green-200");
        expect(screen.getByLabelText("E4").className).toContain("bg-indigo-50");
    });

    it("flashes a wrong key red", async () => {
        render(<Keyboard from={60} to={67} wrong={{ note: 62, seq: 1 }} />);
        await waitFor(() => expect(screen.getByLabelText("D4").className).toContain("bg-red-200"));
    });

    it("reports presses and releases to the parent", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} onRelease={onRelease} />);
        const key = screen.getByLabelText("C4");
        fireEvent.pointerDown(key);
        fireEvent.pointerUp(key);
        expect(onPress).toHaveBeenCalledWith(60);
        expect(onRelease).toHaveBeenCalledWith(60);
    });

    it("releases a key activated and released with the keyboard, not just the pointer", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} onRelease={onRelease} />);
        const key = screen.getByLabelText("C4");
        fireEvent.keyDown(key, { key: "Enter" });
        fireEvent.keyUp(key, { key: "Enter" });
        expect(onPress).toHaveBeenCalledWith(60);
        // Without a keyup handler the note would stay held for a keyboard-only player.
        expect(onRelease).toHaveBeenCalledWith(60);
    });

    it("presses only once for a touch tap that re-fires enter on the same key", () => {
        // Touch releases the implicit pointer capture in `down`, so the browser
        // re-hit-tests and fires a synthetic pointerenter (buttons held) on the very
        // key just pressed. That must not sound the note a second time.
        const onPress = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} />);
        const c = screen.getByLabelText("C4");
        fireEvent.pointerDown(c, { pointerId: 1 });
        fireEvent.pointerEnter(c, { pointerId: 1, buttons: 1 });
        fireEvent.pointerUp(c, { pointerId: 1 });
        expect(onPress).toHaveBeenCalledTimes(1);
        expect(onPress).toHaveBeenCalledWith(60);
    });

    it("sounds each finger of a two-touch chord once", () => {
        const onPress = vi.fn();
        render(<Keyboard from={60} to={64} onPress={onPress} />);
        const c = screen.getByLabelText("C4");
        const e = screen.getByLabelText("E4");
        fireEvent.pointerDown(c, { pointerId: 1 });
        fireEvent.pointerEnter(c, { pointerId: 1, buttons: 1 });
        fireEvent.pointerDown(e, { pointerId: 2 });
        fireEvent.pointerEnter(e, { pointerId: 2, buttons: 1 });
        expect(onPress).toHaveBeenCalledTimes(2);
        expect(onPress).toHaveBeenCalledWith(60);
        expect(onPress).toHaveBeenCalledWith(64);
    });

    it("glides note to note when a held pointer slides across keys", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} onRelease={onRelease} />);
        const c = screen.getByLabelText("C4");
        const d = screen.getByLabelText("D4");
        // Press C, drag off it onto D (button still held), then lift on D.
        fireEvent.pointerDown(c);
        fireEvent.pointerLeave(c, { buttons: 1 });
        fireEvent.pointerEnter(d, { buttons: 1 });
        fireEvent.pointerUp(d);
        expect(onPress).toHaveBeenNthCalledWith(1, 60);
        expect(onRelease).toHaveBeenCalledWith(60);
        expect(onPress).toHaveBeenNthCalledWith(2, 62);
        expect(onRelease).toHaveBeenCalledWith(62);
    });

    it("does not press a key merely hovered with no button held", () => {
        const onPress = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} />);
        fireEvent.pointerEnter(screen.getByLabelText("D4"), { buttons: 0 });
        expect(onPress).not.toHaveBeenCalled();
    });

    it("keeps a leading black key inside the keyboard", () => {
        render(<Keyboard from={61} to={67} />);
        const black = screen.getByLabelText("C#4");
        const left = Number.parseFloat(black.style.left);
        const width = Number.parseFloat(black.style.width);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(left + width).toBeLessThanOrEqual(100);
    });
});
