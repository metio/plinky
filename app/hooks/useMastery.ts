// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useSyncExternalStore } from "react";
import type { Mastery } from "../../core/mastery";
import { useMasteryStore } from "../contexts/services";

// Subscribe a component to one score's mastery, re-rendering whenever a finished
// run or a manual mark updates it anywhere in the app. Null on the server and for a
// score that has never been played.
export function useMastery(id: string): Mastery | null {
    const store = useMasteryStore();
    return useSyncExternalStore(
        store.subscribe,
        () => store.load(id),
        () => null,
    );
}
