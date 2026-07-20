// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Analytics } from "../ports/analytics";

// The Google Analytics (gtag.js) adapter. The measurement id is baked in at build
// time from VITE_ANALYTICS_ID — set only on the production deploy, so previews and
// local dev carry no id and this adapter is inert (a visitor there could opt in and
// still nothing loads). gtag is injected lazily on the first opt-in; toggling off
// sets Google's own `ga-disable-<id>` flag, honoured on every hit, so collection
// stops even after the script has loaded.
const MEASUREMENT_ID = import.meta.env.VITE_ANALYTICS_ID as string | undefined;

function inject(id: string): void {
    const win = window as unknown as { dataLayer?: unknown[] };
    win.dataLayer = win.dataLayer ?? [];
    const gtag = (...args: unknown[]) => {
        win.dataLayer?.push(args);
    };
    gtag("js", new Date());
    gtag("config", id);
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
        },
    };
}

export const webAnalytics = gtagAnalytics();
