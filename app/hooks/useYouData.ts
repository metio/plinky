// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
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

    if (items === null) {
        return null;
    }

    return buildYouData({
        items,
        catalogue,
        mode: prefs.decayMode,
        reviewCap: prefs.reviewCap,
        summary,
        fingerprint,
        reachedGrade: services.milestones.reachedGrade(),
        flawless: services.milestones.flawlessDone(),
        consented: prefs.analyticsConsent,
        now: Date.now(),
    });
}
