// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Keyboard } from "./keyboard";

afterEach(cleanup);

// jsdom does no layout, so document.elementFromPoint is absent; stand it in with the
// key the finger is meant to be over, and restore the original binding afterwards.
function stubHitTest(element: Element): () => void {
    const owner = document as unknown as { elementFromPoint?: (x: number, y: number) => Element };
    const original = owner.elementFromPoint;
    owner.elementFromPoint = () => element;
    return () => {
        owner.elementFromPoint = original;
    };
}

describe("Keyboard", () => {
    it("labels every key in the range", () => {
        render(<Keyboard from={60} to={62} />);
        expect(screen.getByLabelText("C 4")).toBeTruthy();
        expect(screen.getByLabelText("C sharp 4")).toBeTruthy();
        expect(screen.getByLabelText("D 4")).toBeTruthy();
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
        expect(screen.getByLabelText("C 4").className).toContain("bg-green-200");
        expect(screen.getByLabelText("E 4").className).toContain("bg-indigo-50");
    });

    it("fills a held note's key to its remaining hold fraction", () => {
        render(<Keyboard from={60} to={67} holds={new Map([[60, 0.4]])} />);
        const fill = screen.getByLabelText("C 4").querySelector<HTMLElement>("[style*='height']");
        expect(fill?.style.height).toBe("40%");
        // A note with no hold shows no fill.
        expect(screen.getByLabelText("E 4").querySelector("[style*='height']")).toBeNull();
    });

    it("flashes a wrong key red", async () => {
        render(<Keyboard from={60} to={67} wrong={{ note: 62, seq: 1 }} />);
        await waitFor(() => expect(screen.getByLabelText("D 4").className).toContain("bg-red-200"));
    });

    it("reports presses and releases to the parent", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} onRelease={onRelease} />);
        const key = screen.getByLabelText("C 4");
        fireEvent.pointerDown(key);
        fireEvent.pointerUp(key);
        expect(onPress).toHaveBeenCalledWith(60);
        expect(onRelease).toHaveBeenCalledWith(60);
    });

    it("releases a key activated and released with the keyboard, not just the pointer", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} onRelease={onRelease} />);
        const key = screen.getByLabelText("C 4");
        fireEvent.keyDown(key, { key: "Enter" });
        fireEvent.keyUp(key, { key: "Enter" });
        expect(onPress).toHaveBeenCalledWith(60);
        // Without a keyup handler the note would stay held for a keyboard-only player.
        expect(onRelease).toHaveBeenCalledWith(60);
    });

    it("presses only once for a tap, even with pointer jitter on the same key", () => {
        // A tap can emit a move or two before the release; a hit-test that stays on the
        // same key must not re-sound it — this is what kept touch taps from doubling.
        const onPress = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} />);
        const c = screen.getByLabelText("C 4");
        const restore = stubHitTest(c);
        fireEvent.pointerDown(c, { pointerId: 1 });
        fireEvent.pointerMove(c, { pointerId: 1, clientX: 5, clientY: 5 });
        fireEvent.pointerUp(c, { pointerId: 1 });
        expect(onPress).toHaveBeenCalledTimes(1);
        expect(onPress).toHaveBeenCalledWith(60);
        restore();
    });

    it("sounds each finger of a two-touch chord once", () => {
        const onPress = vi.fn();
        render(<Keyboard from={60} to={64} onPress={onPress} />);
        const c = screen.getByLabelText("C 4");
        const e = screen.getByLabelText("E 4");
        fireEvent.pointerDown(c, { pointerId: 1 });
        fireEvent.pointerDown(e, { pointerId: 2 });
        expect(onPress).toHaveBeenCalledTimes(2);
        expect(onPress).toHaveBeenCalledWith(60);
        expect(onPress).toHaveBeenCalledWith(64);
    });

    it("glides note to note when a held pointer slides across keys", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} onRelease={onRelease} />);
        const c = screen.getByLabelText("C 4");
        const d = screen.getByLabelText("D 4");
        // Press C, then drag onto D: each move is hit-tested to the key under the finger,
        // which jsdom can't compute from layout, so stand in for elementFromPoint.
        const restore = stubHitTest(d);
        fireEvent.pointerDown(c);
        fireEvent.pointerMove(c, { clientX: 30, clientY: 10 });
        fireEvent.pointerUp(d);
        expect(onPress).toHaveBeenNthCalledWith(1, 60);
        expect(onRelease).toHaveBeenCalledWith(60);
        expect(onPress).toHaveBeenNthCalledWith(2, 62);
        expect(onRelease).toHaveBeenCalledWith(62);
        restore();
    });

    it("keeps the glide alive after the finger slides off the keys and back", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} onRelease={onRelease} />);
        const c = screen.getByLabelText("C 4");
        const d = screen.getByLabelText("D 4");
        fireEvent.pointerDown(c, { pointerId: 1 });
        // Drift into a gap / off the keybed: the hit-test returns null, releasing C but
        // leaving the pointer live.
        let restore = stubHitTest(document.body);
        fireEvent.pointerMove(c, { pointerId: 1, clientX: 0, clientY: 999 });
        restore();
        expect(onRelease).toHaveBeenCalledWith(60);
        // Slide back onto D: the glide must re-engage and sound it.
        restore = stubHitTest(d);
        fireEvent.pointerMove(c, { pointerId: 1, clientX: 30, clientY: 10 });
        expect(onPress).toHaveBeenCalledWith(62);
        restore();
    });

    it("sounds a held Enter only once despite key auto-repeat", () => {
        const onPress = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} />);
        const c = screen.getByLabelText("C 4");
        fireEvent.keyDown(c, { key: "Enter" });
        fireEvent.keyDown(c, { key: "Enter", repeat: true });
        fireEvent.keyDown(c, { key: "Enter", repeat: true });
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("keeps a two-touch shared key sounding until the last finger lifts", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} onRelease={onRelease} />);
        const c = screen.getByLabelText("C 4");
        fireEvent.pointerDown(c, { pointerId: 1 });
        fireEvent.pointerDown(c, { pointerId: 2 });
        // Sounded once (both fingers on one key).
        expect(onPress).toHaveBeenCalledTimes(1);
        // Lifting one finger must NOT release the note the other still holds.
        fireEvent.pointerUp(c, { pointerId: 1 });
        expect(onRelease).not.toHaveBeenCalled();
        fireEvent.pointerUp(c, { pointerId: 2 });
        expect(onRelease).toHaveBeenCalledWith(60);
    });

    it("releases a held note when the keyboard unmounts", () => {
        const onRelease = vi.fn();
        const { unmount } = render(<Keyboard from={60} to={62} onRelease={onRelease} />);
        fireEvent.pointerDown(screen.getByLabelText("C 4"), { pointerId: 1 });
        unmount();
        expect(onRelease).toHaveBeenCalledWith(60);
    });

    it("releases a held glide note when pointer capture is lost", () => {
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onRelease={onRelease} />);
        const c = screen.getByLabelText("C 4");
        fireEvent.pointerDown(c, { pointerId: 1 });
        fireEvent.lostPointerCapture(c, { pointerId: 1 });
        expect(onRelease).toHaveBeenCalledWith(60);
    });

    it("passes a tap-position velocity when the key has layout", () => {
        const onPress = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} />);
        const c = screen.getByLabelText("C 4");
        // Give the key a real box so velocityAt can read a fraction of its height.
        c.getBoundingClientRect = () => ({ top: 0, height: 100, left: 0, width: 20 }) as DOMRect;
        fireEvent.pointerDown(c, { pointerId: 1, clientY: 100 }); // struck at the tip → loud
        const velocity = onPress.mock.calls[0]![1];
        expect(velocity).toBe(120);
    });

    it("moves the roving focus across keys with the arrow keys", () => {
        render(<Keyboard from={60} to={64} />);
        const c = screen.getByLabelText("C 4");
        const cs = screen.getByLabelText("C sharp 4");
        expect(c.tabIndex).toBe(0); // the range start is the single tab stop
        expect(cs.tabIndex).toBe(-1);
        fireEvent.keyDown(c, { key: "ArrowRight" });
        expect(cs.tabIndex).toBe(0);
        expect(cs).toBe(document.activeElement);
    });

    it("does not sound a key when a pointer moves over it with none held down", () => {
        const onPress = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} />);
        const d = screen.getByLabelText("D 4");
        const restore = stubHitTest(d);
        fireEvent.pointerMove(d, { clientX: 30, clientY: 10 });
        expect(onPress).not.toHaveBeenCalled();
        restore();
    });

    it("sounds a brief note for a screen reader's synthesized click", () => {
        vi.useFakeTimers();
        const onPress = vi.fn();
        const onRelease = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} onRelease={onRelease} />);
        // An assistive-tech activation arrives as a click with detail 0 and no pointer.
        fireEvent.click(screen.getByLabelText("C 4"), { detail: 0 });
        expect(onPress).toHaveBeenCalledWith(60);
        expect(onRelease).not.toHaveBeenCalled();
        // It self-releases shortly after, since AT gives no key-up gesture.
        vi.advanceTimersByTime(200);
        expect(onRelease).toHaveBeenCalledWith(60);
        vi.useRealTimers();
    });

    it("ignores the compatibility click that trails a real pointer tap", () => {
        const onPress = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} />);
        const c = screen.getByLabelText("C 4");
        const restore = stubHitTest(c);
        // A mouse/touch tap: pointer down/up sounds the note once; the trailing click
        // (positive detail) must not sound it again.
        fireEvent.pointerDown(c, { pointerId: 1 });
        fireEvent.pointerUp(c, { pointerId: 1 });
        fireEvent.click(c, { detail: 1 });
        expect(onPress).toHaveBeenCalledTimes(1);
        restore();
    });

    it("does not double-sound when Enter also emits a click", () => {
        const onPress = vi.fn();
        render(<Keyboard from={60} to={62} onPress={onPress} />);
        const c = screen.getByLabelText("C 4");
        fireEvent.keyDown(c, { key: "Enter" });
        fireEvent.keyUp(c, { key: "Enter" });
        // A keyboard activation can also emit a detail-0 click; the recent key use
        // suppresses the fallback so the note isn't sounded twice.
        fireEvent.click(c, { detail: 0 });
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("keeps a leading black key inside the keyboard", () => {
        render(<Keyboard from={61} to={67} />);
        const black = screen.getByLabelText("C sharp 4");
        const left = Number.parseFloat(black.style.left);
        const width = Number.parseFloat(black.style.width);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(left + width).toBeLessThanOrEqual(100);
    });
});
