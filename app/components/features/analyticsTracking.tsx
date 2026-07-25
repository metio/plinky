// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { clickInfo } from "../../../core/analyticsClick";
import { prefChanges } from "../../../core/analyticsPrefs";
import { useAnalytics, useOnboardingStore, usePrefsStore } from "../../contexts/services";
import { deLocalizeHref, getLocale } from "../../paraglide/runtime.js";

// The controls a click counts as a "button press": real buttons and links, plus the
// ARIA widgets the app builds from divs (switches, tabs) and a disclosure summary.
const ACTIONABLE = "button, a[href], [role='button'], [role='switch'], [role='tab'], summary";

// A switch is built from a <button>, so it has to be excluded by role rather than left
// out of the selector above. Flipping one already reports the change itself — with the
// value, which a click can't carry — so counting the press too would double every
// toggle. The session-only toggles that never reach the preferences store are carried
// by the run events instead, so nothing goes unreported.
const isToggle = (el: Element): boolean => el.getAttribute("role") === "switch";

// Sends anonymous usage analytics — a page view per navigation, a setting_changed event
// per preference write, and a click event for every button/link/toggle press. Renders
// nothing, like AnalyticsConsent; it lives at the composition root so one place feeds the
// analytics capability and every route, setting and interaction flows through it. Every
// call is a no-op until consent is granted (the capability drops it), so nothing here
// needs to know the consent state.
export function AnalyticsTracking() {
    const analytics = useAnalytics();
    const store = usePrefsStore();
    const onboarding = useOnboardingStore();
    const { pathname } = useLocation();
    // The live page, read by the click listener (a stable listener, not re-bound per
    // navigation) so each click is attributed to the page it happened on.
    const pathnameRef = useRef(pathname);
    pathnameRef.current = pathname;

    // One page view per navigation. The path is de-localized so /en/play and /de/play
    // report the same page — the locale rides its own param, not the path dimension.
    useEffect(() => {
        analytics.track("page_view", { page_path: deLocalizeHref(pathname), locale: getLocale() });
    }, [analytics, pathname]);

    // A click event for every interactive control, caught by one delegated listener. The
    // capture phase fires it even when a handler stops propagation; the closest() walk
    // finds the control the visitor actually pressed and skips clicks that land on nothing
    // actionable — or inside the on-screen keyboard, which is the instrument, not UI.
    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            const start = event.target;
            if (!(start instanceof Element)) {
                return;
            }
            const el = start.closest(ACTIONABLE);
            if (!el || isToggle(el) || el.closest("[data-analytics-skip]")) {
                return;
            }
            const info = clickInfo({
                dataAnalytics: el.getAttribute("data-analytics"),
                ariaLabel: el.getAttribute("aria-label"),
                text: el.textContent,
                title: el.getAttribute("title"),
                tag: el.tagName.toLowerCase(),
                role: el.getAttribute("role"),
            });
            if (info) {
                analytics.track("click", {
                    label: info.label,
                    control: info.control,
                    page_path: deLocalizeHref(pathnameRef.current),
                });
            }
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [analytics]);

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

    // A discovery_marked event per getting-started step reached. The store is the single
    // choke point every markDiscovered call funnels through, and it already de-dupes, so
    // each step reports once ever — no matter which of the eight surfaces marked it.
    // Diffing its set the same way settings diff theirs keeps a rehydrated set silent.
    useEffect(() => {
        let previous = onboarding.marked();
        return onboarding.subscribe(() => {
            const next = onboarding.marked();
            for (const step of next) {
                if (!previous.has(step)) {
                    analytics.track("discovery_marked", { step });
                }
            }
            previous = next;
        });
    }, [analytics, onboarding]);

    return null;
}
