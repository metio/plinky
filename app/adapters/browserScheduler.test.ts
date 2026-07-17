// @vitest-environment jsdom
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, describe, expect, it, vi } from "vitest";
import { browserScheduler } from "./browserScheduler";

afterEach(() => {
    vi.useRealTimers();
});

describe("browserScheduler", () => {
    it("runs after() once, at the delay", () => {
        vi.useFakeTimers();
        const run = vi.fn();

        browserScheduler.after(50, run);

        vi.advanceTimersByTime(49);
        expect(run).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(run).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(500);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("repeats every() until cancelled", () => {
        vi.useFakeTimers();
        const run = vi.fn();

        const handle = browserScheduler.every(10, run);
        vi.advanceTimersByTime(30);
        expect(run).toHaveBeenCalledTimes(3);

        browserScheduler.cancel(handle);
        vi.advanceTimersByTime(100);
        expect(run).toHaveBeenCalledTimes(3);
    });

    // after() and every() share one cancel(), so it must clear either kind
    // without the caller tracking which it created.
    it("cancels a pending after() through the same cancel()", () => {
        vi.useFakeTimers();
        const run = vi.fn();

        browserScheduler.cancel(browserScheduler.after(10, run));
        vi.advanceTimersByTime(100);

        expect(run).not.toHaveBeenCalled();
    });

    it("ignores a cancel of an unknown handle", () => {
        expect(() => browserScheduler.cancel(999_999)).not.toThrow();
    });

    it("runs frame() on the next animation frame, and cancelFrame() stops it", async () => {
        const run = vi.fn();
        const skipped = vi.fn();

        browserScheduler.frame(run);
        browserScheduler.cancelFrame(browserScheduler.frame(skipped));
        await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));

        expect(skipped).not.toHaveBeenCalled();
        expect(typeof run.mock.calls[0]?.[0]).toBe("number");
    });

    it("reads a monotonic clock that never runs backwards", () => {
        const first = browserScheduler.now();
        const second = browserScheduler.now();

        expect(typeof first).toBe("number");
        expect(second).toBeGreaterThanOrEqual(first);
    });
});
