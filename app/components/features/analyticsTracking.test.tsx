// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "../../../core/prefs";
import { fakeAnalytics } from "../../adapters/fakeAnalytics";
import { memoryStore } from "../../adapters/memoryStore";
import { createPrefsStore } from "../../stores/prefsStore";
import { renderWithServices } from "../../testing/renderWithServices";
import { AnalyticsTracking } from "./analyticsTracking";

afterEach(cleanup);

const at = (path: string, ui: ReactNode = null) => (
    <MemoryRouter initialEntries={[path]}>
        <AnalyticsTracking />
        {ui}
    </MemoryRouter>
);

describe("AnalyticsTracking", () => {
    it("sends a de-localized page view on mount, with the locale as its own param", () => {
        const analytics = fakeAnalytics();
        renderWithServices(at("/de/play"), { analytics });
        const view = analytics.events().find((event) => event.event === "page_view");
        // The locale prefix is stripped from the path (it rides its own param, resolved
        // by the paraglide runtime rather than the raw URL).
        expect(view?.params.page_path).toBe("/play");
        expect(typeof view?.params.locale).toBe("string");
    });

    it("sends a setting_changed event on a preference write, not on mount", () => {
        const analytics = fakeAnalytics();
        const store = createPrefsStore(memoryStore());
        renderWithServices(at("/en/play"), { analytics, prefs: store });
        // Mount alone must not emit a setting change — only the page view.
        expect(analytics.events().some((event) => event.event === "setting_changed")).toBe(false);
        // A real write emits one event per changed setting.
        store.save({ ...DEFAULT_PREFS, colorNotes: !DEFAULT_PREFS.colorNotes });
        expect(analytics.events()).toContainEqual({
            event: "setting_changed",
            params: { setting: "colorNotes", value: !DEFAULT_PREFS.colorNotes },
        });
    });

    it("sends a click event for a pressed control, named and attributed to the page", () => {
        const analytics = fakeAnalytics();
        renderWithServices(
            at(
                "/en/library",
                <button type="button" aria-label="Save take">
                    Save
                </button>,
            ),
            { analytics },
        );
        fireEvent.click(screen.getByRole("button", { name: "Save take" }));
        expect(analytics.events()).toContainEqual({
            event: "click",
            params: { label: "Save take", control: "button", page_path: "/library" },
        });
    });

    it("ignores a switch — flipping one reports the change, with its value, on its own", () => {
        const analytics = fakeAnalytics();
        renderWithServices(
            at(
                "/en/settings",
                <button type="button" role="switch" aria-checked="false">
                    Colour the notes
                </button>,
            ),
            { analytics },
        );
        fireEvent.click(screen.getByRole("switch", { name: "Colour the notes" }));
        expect(analytics.events().some((event) => event.event === "click")).toBe(false);
    });

    it("ignores a control that opts out, so a typed event isn't counted twice", () => {
        const analytics = fakeAnalytics();
        renderWithServices(
            at(
                "/en/you",
                <div data-analytics-skip="">
                    <button type="button">Copy</button>
                </div>,
            ),
            { analytics },
        );
        fireEvent.click(screen.getByRole("button", { name: "Copy" }));
        expect(analytics.events().some((event) => event.event === "click")).toBe(false);
    });

    it("ignores clicks inside the on-screen keyboard — the instrument, not UI", () => {
        const analytics = fakeAnalytics();
        renderWithServices(
            at(
                "/en/play",
                <div data-analytics-skip="">
                    <button type="button" aria-label="C 4">
                        key
                    </button>
                </div>,
            ),
            { analytics },
        );
        fireEvent.click(screen.getByRole("button", { name: "C 4" }));
        expect(analytics.events().some((event) => event.event === "click")).toBe(false);
    });
});
