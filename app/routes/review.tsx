// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { ReviewSession } from "../components/features/reviewSession";
import { noindexMeta, routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/review";

export function meta(_args: Route.MetaArgs) {
    // A personal, data-driven review session — no place in the index, so noindex it
    // (and it is left out of the sitemap).
    return [...routeMeta(m.review_heading(), m.meta_review_description()), noindexMeta()];
}

export default function ReviewRoute() {
    return <ReviewSession />;
}
