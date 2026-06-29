// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import { masterySnapshot, subscribeMastery } from "../lib/masteryStore";
import type { Mastery } from "../lib/mastery";

// Subscribe a component to one score's mastery, re-rendering whenever a finished
// run or a manual mark updates it anywhere in the app. Null on the server and for a
// score that has never been played.
export function useMastery(id: string): Mastery | null {
    return useSyncExternalStore(
        subscribeMastery,
        () => masterySnapshot(id),
        () => null,
    );
}
