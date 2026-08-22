// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Tap-to-cycle: a control that has no room for a menu steps through its settings one tap
// at a time, and wraps at the end.

// The next setting after the current one, wrapping past the last back to the first. A
// value the cycle does not contain starts it from the beginning, so a stored setting that
// has since been removed still leaves the control working.
export function nextIn<T>(cycle: readonly T[], current: T): T {
    // An empty cycle offers nothing to move to; the modulo would hand back undefined
    // dressed as a setting, and the control would clear whatever it was showing.
    if (cycle.length === 0) {
        return current;
    }
    const index = cycle.indexOf(current);
    return cycle[(index + 1) % cycle.length] as T;
}
