// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { generatePhrase } from "./generator";
import { hashString, seededRandom } from "./random";

// The UTC date as YYYY-MM-DD, used as the daily challenge's shared seed.
export function todayKey(now: Date): string {
    return now.toISOString().slice(0, 10);
}

// The phrase for a given day — identical for everyone, because the generator is
// fed a PRNG seeded from the date.
export function dailyPhrase(dateKey: string): string {
    return generatePhrase(
        { bars: 16, beatsPerBar: 4, twoHands: false },
        seededRandom(hashString(dateKey)),
    );
}
