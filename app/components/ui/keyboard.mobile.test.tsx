// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Keyboard } from "./keyboard";

// The real-browser, real-touch counterpart of keyboard.test.tsx: here the keys have
// actual layout, so the glide's document.elementFromPoint hit-test resolves the key
// under the finger for real — the path jsdom can only stand in for. Runs in the
// browser-mobile project (coarse touch pointer, phone viewport).

let mounted: HTMLElement[] = [];

afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

function mount(ui: React.ReactElement) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    mounted.push(container);
    return render(ui, { container });
}

function centerOf(element: Element): { x: number; y: number } {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function touch(type: string, target: Element, at: { x: number; y: number }, down = true) {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            clientX: at.x,
            clientY: at.y,
            buttons: down ? 1 : 0,
        }),
    );
}

describe("Keyboard touch", () => {
    it("sounds a tapped key exactly once", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        const { getByLabelText } = mount(
            <Keyboard from={60} to={64} onPress={onPress} onRelease={onRelease} />,
        );
        const c = getByLabelText("C4");
        const at = centerOf(c);
        touch("pointerdown", c, at);
        touch("pointerup", c, at, false);
        expect(onPress).toHaveBeenCalledTimes(1);
        expect(onPress).toHaveBeenCalledWith(60);
        expect(onRelease).toHaveBeenCalledWith(60);
    });

    it("glides across the keys a dragged finger crosses, each sounded once", () => {
        const onPress = vi.fn();
        const onRelease = vi.fn();
        const { getByLabelText } = mount(
            <Keyboard from={60} to={64} onPress={onPress} onRelease={onRelease} />,
        );
        const c = getByLabelText("C4");
        const d = getByLabelText("D4");
        const e = getByLabelText("E4");
        // Press C, slide across D to E, lift on E.
        touch("pointerdown", c, centerOf(c));
        touch("pointermove", c, centerOf(d));
        touch("pointermove", c, centerOf(e));
        touch("pointerup", c, centerOf(e), false);
        expect(onPress.mock.calls.map((call) => call[0])).toEqual([60, 62, 64]);
        expect(onRelease).toHaveBeenCalledWith(60);
        expect(onRelease).toHaveBeenCalledWith(62);
        expect(onRelease).toHaveBeenCalledWith(64);
    });
});
