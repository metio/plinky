// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ServicesProvider } from "../contexts/services";
import { fakeScheduler } from "../testing/fakeScheduler";
import { useCopied } from "./useCopied";

// The payoff of the Scheduler seam: a time-based path driven deterministically in
// a REAL browser. vi.useFakeTimers can't freeze a browser's event loop, so this
// would otherwise need a real 2-second wait (slow, and flake-prone). Injecting the
// fake clock, the revert happens exactly when the test winds time forward — no
// waiting, no polling, no flake.

let mounted: HTMLElement[] = [];
afterEach(() => {
    for (const element of mounted) {
        element.remove();
    }
    mounted = [];
});

function Harness() {
    const [copied, flash] = useCopied(2000);
    return (
        <button type="button" onClick={() => flash("done")}>
            {copied ?? "idle"}
        </button>
    );
}

function mount(scheduler: ReturnType<typeof fakeScheduler>) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    mounted.push(container);
    render(
        <ServicesProvider services={{ scheduler }}>
            <Harness />
        </ServicesProvider>,
        { container },
    );
}

describe("useCopied on the injected clock (real browser)", () => {
    it("holds the confirmation until the clock reaches the revert, then clears it", () => {
        const scheduler = fakeScheduler();
        mount(scheduler);
        const button = screen.getByRole("button");

        fireEvent.click(button);
        expect(button.textContent).toBe("done");

        // Just short of the revert: still showing.
        act(() => scheduler.advance(1999));
        expect(button.textContent).toBe("done");

        // The revert fires the instant the clock crosses it — deterministically.
        act(() => scheduler.advance(1));
        expect(button.textContent).toBe("idle");
    });
});
