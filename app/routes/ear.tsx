// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { EarTrainer } from "../components/earTrainer";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/ear";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.ear_heading(), m.meta_ear_description());
}

export default function EarRoute() {
    return <EarTrainer />;
}
