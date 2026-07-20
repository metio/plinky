// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Analytics } from "../ports/analytics";

// The Google Analytics (gtag.js) adapter. The measurement id is baked in at build
// time from VITE_ANALYTICS_ID — set only on the production deploy, so previews and
// local dev carry no id and this adapter is inert (a visitor there could opt in and
// still nothing loads). gtag is injected lazily on the first opt-in; toggling off
// sets Google's own `ga-disable-<id>` flag, honoured on every hit, so collection
// stops even after the script has loaded.
//
// It also speaks Google Consent Mode v2, the signal Google's own tags read. The tag
// only loads after a deliberate opt-in, so it is unnecessary today — but it is the
// shape Google's tooling expects and keeps us forward-compatible for the day ads /
// GTM enter the picture. On load every consent type defaults to "denied" (before the
// config command that could store anything), and each opt-in/opt-out pushes a
// consent "update" reflecting the choice onto `analytics_storage`. Consent Mode does
// not gather the choice — the first-visit ConsentBanner does that; this only relays
// it to the tag.
const MEASUREMENT_ID = import.meta.env.VITE_ANALYTICS_ID as string | undefined;

function gtagPush(...args: unknown[]): void {
    const win = window as unknown as { dataLayer?: unknown[] };
    win.dataLayer = win.dataLayer ?? [];
    win.dataLayer.push(args);
}

function inject(id: string): void {
    // Consent Mode default: everything denied until an update grants it, pushed
    // before `config` so no storage is used ahead of the granted signal.
    gtagPush("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
    });
    gtagPush("js", new Date());
    gtagPush("config", id);
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
}

// `id` is injectable so a test can exercise the injection with a stand-in; in
// production it defaults to the build-time measurement id.
export function gtagAnalytics(id: string | undefined = MEASUREMENT_ID): Analytics {
    let injected = false;
    return {
        setConsent(on) {
            if (!id) {
                return;
            }
            (window as unknown as Record<string, boolean>)[`ga-disable-${id}`] = !on;
            if (on && !injected) {
                injected = true;
                inject(id);
            }
            // Relay the choice to Consent Mode once the tag exists (a decline before
            // any opt-in never loads it, so there is nothing to tell).
            if (injected) {
                gtagPush("consent", "update", {
                    analytics_storage: on ? "granted" : "denied",
                });
            }
        },
    };
}

export const webAnalytics = gtagAnalytics();
