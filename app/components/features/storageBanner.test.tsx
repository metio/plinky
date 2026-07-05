// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type StorageHealth, StorageBanner } from "./storageBanner";

afterEach(cleanup);

// A controllable stand-in for the adapter's health signal — the banner takes it
// as a prop, so the test never touches localStorage or the real adapter.
function fakeHealth(initiallyFailed = false): StorageHealth & { fail(): void } {
    let failed = initiallyFailed;
    const listeners = new Set<() => void>();
    return {
        failed: () => failed,
        subscribe(onChange) {
            listeners.add(onChange);
            return () => {
                listeners.delete(onChange);
            };
        },
        fail() {
            failed = true;
            for (const listener of [...listeners]) {
                listener();
            }
        },
    };
}

describe("StorageBanner", () => {
    it("renders nothing while storage is healthy", () => {
        render(<StorageBanner health={fakeHealth()} />);
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("appears the moment a write fails", () => {
        const health = fakeHealth();
        render(<StorageBanner health={health} />);
        act(() => health.fail());
        expect(screen.getByRole("alert").textContent).toContain("storage is full or blocked");
    });

    it("shows immediately when the failure predates the mount", () => {
        render(<StorageBanner health={fakeHealth(true)} />);
        expect(screen.getByRole("alert")).toBeDefined();
    });

    it("dismisses on ✕ and stays dismissed for this page load", () => {
        const health = fakeHealth(true);
        render(<StorageBanner health={health} />);
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(screen.queryByRole("alert")).toBeNull();
        // A repeat failure signal does not resurrect the dismissed banner.
        act(() => health.fail());
        expect(screen.queryByRole("alert")).toBeNull();
    });
});
