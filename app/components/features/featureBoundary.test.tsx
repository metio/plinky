// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "../../paraglide/messages.js";
import { FeatureBoundary } from "./featureBoundary";

// React prints the caught error and its component stack to the console by design.
// That is noise here — the throw is the point of every test — so it is silenced for
// the file rather than left to bury the real output.
beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function Boom({ throws }: { throws: boolean }) {
    if (throws) {
        throw new Error("panel exploded");
    }
    return <p>the panel</p>;
}

describe("FeatureBoundary", () => {
    it("shows the panel it wraps when nothing is wrong", () => {
        render(
            <FeatureBoundary feature="Panel">
                <Boom throws={false} />
            </FeatureBoundary>,
        );

        expect(screen.getByText("the panel")).toBeTruthy();
        expect(screen.queryByText(m.feature_broken())).toBeNull();
    });

    it("replaces only the broken panel, leaving its neighbours standing", () => {
        render(
            <div>
                <p>before</p>
                <FeatureBoundary feature="Panel">
                    <Boom throws={true} />
                </FeatureBoundary>
                <p>after</p>
            </div>,
        );

        // The whole point: a throw costs the reader this panel, not the page.
        expect(screen.getByText(m.feature_broken())).toBeTruthy();
        expect(screen.getByText("before")).toBeTruthy();
        expect(screen.getByText("after")).toBeTruthy();
    });

    it("recovers when the retry finds the panel working again", () => {
        // A panel that failed on a transient read comes back on a press, which is why
        // the retry is worth offering even though a deterministic fault throws again.
        const fault = { present: true };
        const Flaky = () => <Boom throws={fault.present} />;

        render(
            <FeatureBoundary feature="Panel">
                <Flaky />
            </FeatureBoundary>,
        );
        expect(screen.getByText(m.feature_broken())).toBeTruthy();

        fault.present = false;
        fireEvent.click(screen.getByRole("button", { name: m.action_try_again() }));

        expect(screen.getByText("the panel")).toBeTruthy();
        expect(screen.queryByText(m.feature_broken())).toBeNull();
    });

    it("keeps failing gracefully when the retry hits the same fault", () => {
        render(
            <FeatureBoundary feature="Panel">
                <Boom throws={true} />
            </FeatureBoundary>,
        );

        fireEvent.click(screen.getByRole("button", { name: m.action_try_again() }));

        // Still the fallback, not a blank panel or a loop.
        expect(screen.getByText(m.feature_broken())).toBeTruthy();
    });

    it("offers a report that names the panel and carries the error", () => {
        // A quieter failure must not be an invisible one: with no server to notice a
        // crash, the reader's report is the only signal that reaches us.
        render(
            <FeatureBoundary feature="SlowNotes">
                <Boom throws={true} />
            </FeatureBoundary>,
        );

        const href = screen
            .getByRole("link", { name: m.action_report_problem() })
            .getAttribute("href");
        expect(href).toContain("github.com/metio/plinky/issues/new");
        expect(decodeURIComponent(href ?? "")).toContain("SlowNotes");
        expect(decodeURIComponent(href ?? "")).toContain("panel exploded");
    });
});
