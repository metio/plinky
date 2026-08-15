// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StatsView } from "../components/features/statsView";
import { noindexMeta, routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/stats";

export function meta(_args: Route.MetaArgs) {
    // A personal progress dashboard, empty until you play — no place in the index,
    // so noindex it (and it is left out of the sitemap).
    return [...routeMeta(m.stats_heading(), m.meta_stats_description()), noindexMeta()];
}

export default function StatsRoute() {
    return <StatsView />;
}
