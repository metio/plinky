// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { GradeLadderView } from "../components/gradeLadderView";
import { routeMeta } from "../lib/site";
import type { Route } from "./+types/grades";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Grades", "Your grade on plinky's practice ladder, and the next one to reach");
}

export default function GradesRoute() {
    return <GradeLadderView />;
}
