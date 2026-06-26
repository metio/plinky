// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { FingeringTrainer } from "../components/fingeringTrainer";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/fingering";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.fingering_heading(), m.meta_fingering_description());
}

export default function FingeringRoute() {
    return <FingeringTrainer />;
}
