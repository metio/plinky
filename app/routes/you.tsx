// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { YouView } from "../components/youView";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/you";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.you_heading(), m.meta_you_description());
}

export default function YouRoute() {
    return <YouView />;
}
