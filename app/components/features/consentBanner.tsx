// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { usePrefs } from "../../hooks/usePrefs";
import { Button } from "../ui/button";
import { linkClasses } from "../ui/classes";
import { LocalizedLink } from "../ui/localizedLink";

// The first-visit analytics consent banner. Google Analytics sets cookies, so it
// stays unloaded until the visitor agrees here; declining is remembered too, so the
// banner asks once and never nags. Accept and Decline carry equal weight — consent
// must be as easy to refuse as to give. Once answered (here or via the Settings
// switch) the choice is stored and the banner is gone.
export function ConsentBanner() {
    const { prefs, update } = usePrefs();
    if (prefs.analyticsAsked) {
        return null;
    }
    return (
        <section
            aria-label={m.consent_banner_label()}
            className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
        >
            <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {m.consent_banner_body()}{" "}
                    <LocalizedLink to="/datenschutz" className={linkClasses}>
                        {m.settings_analytics_link()}
                    </LocalizedLink>
                </p>
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => update({ analyticsConsent: false, analyticsAsked: true })}
                    >
                        {m.consent_decline()}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => update({ analyticsConsent: true, analyticsAsked: true })}
                    >
                        {m.consent_accept()}
                    </Button>
                </div>
            </div>
        </section>
    );
}
