// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StorageHealth, StorageProblem } from "../../ports/storageHealth";
import { StorageBanner } from "./storageBanner";

afterEach(cleanup);

// A controllable stand-in for the adapter's health signal — the banner takes it
// as a prop, so the test never touches localStorage or the real adapter.
function fakeHealth(initially: StorageProblem = null): StorageHealth & { fail(): void } {
    let problem = initially;
    const listeners = new Set<() => void>();
    return {
        problem: () => problem,
        subscribe(onChange) {
            listeners.add(onChange);
            return () => {
                listeners.delete(onChange);
            };
        },
        fail() {
            problem = "refused";
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
        render(<StorageBanner health={fakeHealth("refused")} />);
        expect(screen.getByRole("alert")).toBeDefined();
    });

    it("dismisses on ✕ and stays dismissed for this page load", () => {
        const health = fakeHealth("refused");
        render(<StorageBanner health={health} />);
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(screen.queryByRole("alert")).toBeNull();
        // A repeat failure signal does not resurrect the dismissed banner.
        act(() => health.fail());
        expect(screen.queryByRole("alert")).toBeNull();
    });
});
