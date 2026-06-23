// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { SprintTrainer } from "../components/sprintTrainer";
import { todayKey } from "../lib/daily";
import { routeMeta } from "../lib/site";
import type { Route } from "./+types/daily";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Daily challenge", "Today's shared one-minute sight-reading challenge");
}

export default function DailyRoute() {
    return <SprintTrainer daily={{ dateKey: todayKey(new Date()) }} />;
}
