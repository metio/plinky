// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { SprintTrainer } from "../components/sprintTrainer";
import type { Route } from "./+types/sprint";

export function meta(_args: Route.MetaArgs) {
    return [
        { title: "Plinky - Sight-reading sprint" },
        {
            name: "description",
            content: "Play as many notes correctly as you can before time runs out",
        },
    ];
}

export default function SprintRoute() {
    return <SprintTrainer />;
}
