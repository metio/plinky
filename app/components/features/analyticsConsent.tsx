// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect } from "react";
import { useAnalytics } from "../../contexts/services";
import { usePrefs } from "../../hooks/usePrefs";

// Mirrors the analytics-consent pref onto the analytics capability: Google
// Analytics loads when the player opts in from Settings and stops when they opt
// out. Renders nothing — it lives so the consent has one home (the pref) and the
// side effect (load / stop gtag) follows it wherever the toggle is flipped. On
// first paint the pref is the default (false), so nothing loads until a real
// opt-in has hydrated.
export function AnalyticsConsent() {
    const analytics = useAnalytics();
    const { prefs } = usePrefs();
    useEffect(() => {
        analytics.setConsent(prefs.analyticsConsent);
    }, [analytics, prefs.analyticsConsent]);
    return null;
}
