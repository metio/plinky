// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef } from "react";
import { recordPractice } from "../lib/history";

// Record a practice session once, when a run transitions into its finished state.
export function useRecordOnFinish(finished: boolean, notes: number): void {
    const recorded = useRef(false);
    useEffect(() => {
        if (finished && !recorded.current) {
            recorded.current = true;
            recordPractice(notes);
        } else if (!finished) {
            recorded.current = false;
        }
    }, [finished, notes]);
}
