// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect } from "react";
import { useLocation } from "react-router";
import { prefChanges } from "../../../core/analyticsPrefs";
import { useAnalytics, usePrefsStore } from "../../contexts/services";
import { deLocalizeHref, getLocale } from "../../paraglide/runtime.js";

// Sends anonymous usage analytics — a page view per navigation and a setting_changed
// event whenever a preference is written. Renders nothing, like AnalyticsConsent; it
// lives at the composition root so one place feeds the analytics capability and every
// route and setting flows through it. Every call is a no-op until consent is granted
// (the capability drops it), so nothing here needs to know the consent state.
export function AnalyticsTracking() {
    const analytics = useAnalytics();
    const store = usePrefsStore();
    const { pathname } = useLocation();

    // One page view per navigation. The path is de-localized so /en/play and /de/play
    // report the same page — the locale rides its own param, not the path dimension.
    useEffect(() => {
        analytics.track("page_view", { page_path: deLocalizeHref(pathname), locale: getLocale() });
    }, [analytics, pathname]);

    // A setting_changed event per landed preference write. Subscribing to the store's
    // own writes — not a React snapshot — means the hydration flip (defaults → stored)
    // never counts as a change, since it is a re-render, not a save. The baseline is the
    // stored value at subscribe time, so only real edits diff.
    useEffect(() => {
        let previous = store.load();
        return store.subscribe(() => {
            const next = store.load();
            for (const change of prefChanges(previous, next)) {
                analytics.track("setting_changed", {
                    setting: change.setting,
                    value: change.value,
                });
            }
            previous = next;
        });
    }, [analytics, store]);

    return null;
}
