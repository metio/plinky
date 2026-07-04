// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { ReviewSession } from "../components/reviewSession";
import { routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/review";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.review_heading(), m.meta_review_description());
}

export default function ReviewRoute() {
    return <ReviewSession />;
}
