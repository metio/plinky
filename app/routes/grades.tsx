// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { GradeLadderView } from "../components/gradeLadderView";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/grades";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.grades_heading(), m.meta_grades_description());
}

export default function GradesRoute() {
    return <GradeLadderView />;
}
