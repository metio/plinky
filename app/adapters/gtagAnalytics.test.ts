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

const dataLayer = () => (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [];
const consentCalls = () =>
    dataLayer().filter((entry) => Array.isArray(entry) && entry[0] === "consent");

afterEach(() => {
    (window as unknown as { dataLayer?: unknown[] }).dataLayer = [];
});

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

    it("defaults Consent Mode to denied then updates it to granted on opt-in", () => {
        const analytics = gtagAnalytics("G-TEST123");
        analytics.setConsent(true);
        // The default (all denied) must be queued before the config command…
        const layer = dataLayer();
        const defaultIndex = layer.findIndex(
            (e) => Array.isArray(e) && e[0] === "consent" && e[1] === "default",
        );
        const configIndex = layer.findIndex((e) => Array.isArray(e) && e[0] === "config");
        expect(defaultIndex).toBeGreaterThanOrEqual(0);
        expect(defaultIndex).toBeLessThan(configIndex);
        expect((layer[defaultIndex] as unknown[])[2]).toMatchObject({
            analytics_storage: "denied",
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
        });
        // …then an update grants analytics.
        expect(consentCalls().at(-1)).toEqual([
            "consent",
            "update",
            { analytics_storage: "granted" },
        ]);
    });

    it("relays a withdrawal to Consent Mode as denied", () => {
        const analytics = gtagAnalytics("G-TEST123");
        analytics.setConsent(true);
        analytics.setConsent(false);
        expect(consentCalls().at(-1)).toEqual([
            "consent",
            "update",
            { analytics_storage: "denied" },
        ]);
    });
});
