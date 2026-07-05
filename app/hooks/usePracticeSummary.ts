// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMemo, useSyncExternalStore } from "react";
import { type PracticeSummary, summarizePractice } from "../../core/history";
import { useHistoryStore } from "../contexts/services";

// Subscribe a component to the practice summary, re-rendering when a finished
// run lands anywhere in the app — the You page updates live instead of showing
// the numbers from mount time. Null on the server, where there is no history.
export function usePracticeSummary(): PracticeSummary | null {
    const store = useHistoryStore();
    const history = useSyncExternalStore(store.subscribe, store.load, () => null);
    return useMemo(() => (history ? summarizePractice(history) : null), [history]);
}
