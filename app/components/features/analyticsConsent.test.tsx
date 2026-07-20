// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeAnalytics } from "../../adapters/fakeAnalytics";
import { renderWithServices } from "../../testing/renderWithServices";
import { AnalyticsConsent } from "./analyticsConsent";

afterEach(cleanup);

describe("AnalyticsConsent", () => {
    it("follows the consent pref onto the analytics capability", () => {
        const analytics = fakeAnalytics();
        const { services } = renderWithServices(<AnalyticsConsent />, { analytics });
        // The default pref is off, so nothing is enabled on first paint.
        expect(analytics.consented()).toBe(false);
        // Opting in from Settings flips the capability on…
        act(() => void services.prefs.save({ ...services.prefs.load(), analyticsConsent: true }));
        expect(analytics.consented()).toBe(true);
        // …and opting back out turns it off again.
        act(() => void services.prefs.save({ ...services.prefs.load(), analyticsConsent: false }));
        expect(analytics.consented()).toBe(false);
    });
});
