// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { effectiveRange, type InstrumentRange } from "../../core/instrumentRange";
import { useMidiConnection } from "../contexts/midi";
import { usePrefs } from "./usePrefs";

// The keys the player can actually reach right now: what they measured, else what a
// connected instrument's own name gives away, else a full piano. Recomputed as devices
// come and go, so unplugging a 61-key controller from a full-size piano widens the reach
// again without anybody having to remember a setting.
export function useInstrumentRange(): InstrumentRange {
    const { prefs } = usePrefs();
    const { devices } = useMidiConnection();
    const stored = prefs.instrumentRange;
    // The names are joined into one string so the memo compares by value: the devices
    // array is rebuilt on every connection poll, and depending on it directly would
    // rebuild the range — and re-run the fit that reads it — on a timer. A newline
    // separates them because it is the one character a device name cannot carry.
    const names = devices.map((device) => device.name).join("\n");
    return useMemo(
        () => effectiveRange(stored, names === "" ? [] : names.split("\n")),
        [stored, names],
    );
}
