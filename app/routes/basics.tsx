// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";

import { useNavigate } from "react-router";
import { noindexMeta, routeMeta } from "../../core/site";
import { levelAids } from "../../core/readingLevel";
import { KeyboardTour } from "../components/features/keyboardTour";
import {
    ServicesProvider,
    useOnboardingStore,
    usePrefsStore,
    useServices,
} from "../contexts/services";
import { localizedHref } from "../components/ui/href";
import { unaidedPrefs } from "../../core/prefs";
import { createFixedPrefsStore } from "../stores/fixedPrefsStore";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/basics";
import { PageHeader } from "../components/ui/pageHeader";

export function meta(_args: Route.MetaArgs) {
    // A hands-on tour rather than a page of prose: there is nothing here for a crawler
    // to index, and it is personal to a device's first session.
    return [...routeMeta(m.basics_title(), m.meta_basics_description()), noindexMeta()];
}

// The way in for someone who has never touched a piano. Everything else in Plinky
// assumes the keyboard is already understood; this is the missing first hour.
export default function Basics() {
    const onboarding = useOnboardingStore();
    // The store rather than usePrefs: this route writes a pref and reads none, and
    // usePrefs subscribes to the whole object — which would re-render the page on every
    // unrelated save (a volume change, a score toggle) for a value it never looks at.
    const prefsStore = usePrefsStore();
    const services = useServices();
    const navigate = useNavigate();
    // The lesson is how to find a key on a real keyboard — the black keys in twos and
    // threes, middle C to the left of a two. A labelled keyboard answers that before it is
    // asked, and the labels are on by default, so the page that teaches finding would be
    // the one page never showing anything to find. The tour runs unaided whatever the
    // player has set; their own keyboard theme, sound and key map are untouched.
    const unaided = useMemo(
        () => ({
            ...services,
            prefs: createFixedPrefsStore(unaidedPrefs(services.prefs.load())),
        }),
        [services],
    );

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.basics_title()} hint={m.basics_intro()} />

            <ServicesProvider services={unaided}>
                <KeyboardTour
                    onFinished={() => {
                        // Finishing ticks the checklist step; nothing about the tour is
                        // required, so leaving part-way simply leaves it unticked.
                        onboarding.markDiscovered("keyboardMet");
                        // Someone who just worked out where middle C is has told us plainly
                        // where they are, so the reading aids go all the way up and the run
                        // panel folds to its essentials. Only the five aid fields move; every
                        // personal and physical preference is left exactly as it was.
                        prefsStore.save({ ...prefsStore.load(), ...levelAids("starter") });
                        navigate(localizedHref("/"));
                    }}
                />
            </ServicesProvider>
        </main>
    );
}
