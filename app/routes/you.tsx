// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { YouView } from "../components/features/youView";
import { noindexMeta, routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/you";

export function meta(_args: Route.MetaArgs) {
    // A personal progress dashboard, empty until you play — no place in the index,
    // so noindex it (and it is left out of the sitemap).
    return [...routeMeta(m.you_heading(), m.meta_you_description()), noindexMeta()];
}

export default function YouRoute() {
    return <YouView />;
}
