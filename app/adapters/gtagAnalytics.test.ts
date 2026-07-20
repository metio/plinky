// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { gtagAnalytics } from "./gtagAnalytics";

const gtagScripts = () =>
    document.head.querySelectorAll("script[src*='googletagmanager.com/gtag']");

afterEach(() => {
    for (const script of gtagScripts()) {
        script.remove();
    }
});

const flag = (id: string) => (window as unknown as Record<string, boolean>)[`ga-disable-${id}`];

describe("gtagAnalytics", () => {
    it("stays inert with no measurement id (preview / dev / test)", () => {
        gtagAnalytics(undefined).setConsent(true);
        expect(gtagScripts()).toHaveLength(0);
    });

    it("injects gtag once on the first opt-in and clears the disable flag", () => {
        const analytics = gtagAnalytics("G-TEST123");
        analytics.setConsent(true);
        expect(gtagScripts()).toHaveLength(1);
        expect(flag("G-TEST123")).toBe(false);
        // A second opt-in must not inject a second script.
        analytics.setConsent(true);
        expect(gtagScripts()).toHaveLength(1);
    });

    it("sets Google's opt-out flag when consent is withdrawn", () => {
        const analytics = gtagAnalytics("G-TEST123");
        analytics.setConsent(true);
        analytics.setConsent(false);
        expect(flag("G-TEST123")).toBe(true);
    });
});
