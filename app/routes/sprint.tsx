// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { SprintTrainer } from "../components/sprintTrainer";
import { routeMeta } from "../lib/site";
import type { Route } from "./+types/sprint";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(
        "Sight-reading sprint",
        "Play as many notes correctly as you can before time runs out",
    );
}

export default function SprintRoute() {
    return <SprintTrainer />;
}
