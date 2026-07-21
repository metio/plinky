// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "../../../core/prefs";
import { fakeAnalytics } from "../../adapters/fakeAnalytics";
import { memoryStore } from "../../adapters/memoryStore";
import { createPrefsStore } from "../../stores/prefsStore";
import { renderWithServices } from "../../testing/renderWithServices";
import { AnalyticsTracking } from "./analyticsTracking";

afterEach(cleanup);

const at = (path: string) => (
    <MemoryRouter initialEntries={[path]}>
        <AnalyticsTracking />
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
});
