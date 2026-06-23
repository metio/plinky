// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { EarTrainer } from "../components/earTrainer";
import { pageTitle } from "../lib/site";
import type { Route } from "./+types/ear";

export function meta(_args: Route.MetaArgs) {
    return [
        { title: pageTitle("Ear training") },
        { name: "description", content: "Train your ear: hear a note and play it back" },
    ];
}

export default function EarRoute() {
    return <EarTrainer />;
}
