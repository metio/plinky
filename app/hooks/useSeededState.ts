// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useState } from "react";

// State seeded from something outside the component — a query parameter, mostly — that
// the player can then change by hand.
//
// Seeding once at mount is the trap: a route element stays mounted across history
// entries of the same page, so Back from ?symbol=staccato to ?symbol=slur updates the
// address and leaves the page on staccato. Seeding by effect is the other trap, one
// render behind and a setter called from a prop. So the choice is remembered together with
// the seed it was made under, and a seed that has moved since wins over it: the address
// bar and the page agree on every history step, and a choice made on the page holds until
// the address changes again.
export function useSeededState<T>(
    seed: string | null,
    initial: (seed: string | null) => T,
): [T, (next: T) => void] {
    const [picked, setPicked] = useState<{ under: string | null; value: T } | null>(null);
    const value = picked !== null && picked.under === seed ? picked.value : initial(seed);
    const set = useCallback((next: T) => setPicked({ under: seed, value: next }), [seed]);
    return [value, set];
}
