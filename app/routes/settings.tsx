// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Route } from "./+types/settings";
import { MidiDebugPanel } from "../components/midiDebugPanel";

export function meta(_args: Route.MetaArgs) {
    return [{ title: "Plinky - Settings" }, { name: "description", content: "Configure Plinky" }];
}

export default function Settings() {
    return <MidiDebugPanel />;
}
