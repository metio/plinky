// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo, useState } from "react";
import { progressGrid } from "../../core/lifetime";
import type { Grid } from "../../core/shareCard";
import { useServices } from "../contexts/services";
import {
    type GradeCatalogItem,
    type GradedMastery,
    loadGradeCatalogue,
    loadGradedMastery,
} from "../lib/gradeProgress";
import { buildYouData, type YouData } from "../lib/youData";
import { usePracticeSummary } from "./usePracticeSummary";
import { usePrefs } from "./usePrefs";

// The "You" page's data, loaded once per mount: mastery and the catalogue arrive
// async (the personal data is absent from the prerendered shell), while the
// practice summary and preferences are live subscriptions. The derivation itself
// is buildYouData's — this hook only gathers its input. Null until the mastery
// has loaded, so the page can paint exactly once, fully.
export function useYouData(): YouData | null {
    const services = useServices();
    const { prefs } = usePrefs();
    const summary = usePracticeSummary();
    const [items, setItems] = useState<GradedMastery[] | null>(null);
    const [catalogue, setCatalogue] = useState<GradeCatalogItem[]>([]);
    const [fingerprint, setFingerprint] = useState<Grid | null>(null);

    useEffect(() => {
        let cancelled = false;
        setFingerprint(progressGrid(services.lifetime.load()));
        loadGradedMastery(services.mastery, services).then(
            (loaded) => !cancelled && setItems(loaded),
        );
        loadGradeCatalogue(services).then((loaded) => !cancelled && setCatalogue(loaded));
        return () => {
            cancelled = true;
        };
    }, [services]);

    // Read every render, so a milestone reached while the page is open still counts —
    // they are two store reads, and as a number and a boolean they key the memo below by
    // value rather than freezing it.
    const reachedGrade = services.milestones.reachedGrade();
    const flawless = services.milestones.flawlessDone();
    const { decayMode, reviewCap } = prefs;

    // Derived once per change of input rather than once per render. Inside, this filters
    // and sorts the whole grade catalogue and walks the mastery for every grade; outside,
    // it was re-run by each of the three async loads at mount and again on every
    // preference saved anywhere in the app.
    //
    // The clock is read inside the memo rather than passed into it: as a dependency,
    // Date.now() would differ every render and the memo would never once hold. What it
    // decides — whether a piece has come due — moves on the scale of days.
    const data = useMemo(
        () =>
            items === null
                ? null
                : buildYouData({
                      items,
                      catalogue,
                      mode: decayMode,
                      reviewCap,
                      summary,
                      fingerprint,
                      reachedGrade,
                      flawless,
                      now: Date.now(),
                  }),
        [items, catalogue, decayMode, reviewCap, summary, fingerprint, reachedGrade, flawless],
    );

    return data;
}
