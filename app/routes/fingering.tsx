// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { FingeringTrainer } from "../components/fingeringTrainer";
import { routeMeta } from "../lib/site";
import type { Route } from "./+types/fingering";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(
        "Fingering trainer",
        "Choose your own fingering and compare it to a comfortable one",
    );
}

export default function FingeringRoute() {
    return <FingeringTrainer />;
}
