// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which measures are played, and in what order.
//
// The last thing the engraver was doing that reading the file did not: a repeat is the one
// place where the order the music is printed in and the order it is played in come apart.
// Everything else about a note — where it sits, how long it lasts, what is written over it
// — is a property of the printed page. This is a property of the performance.
//
// Handled: forward and backward repeat barlines, a backward repeat asking for more than one
// return, and endings (first time, second time). NOT handled: da capo, dal segno, and the
// coda jumps, which are written as words rather than as barlines. A score using them plays
// straight through, which is what it did before this existed.

export type MeasureRepeats = {
    // A repeat barline at the left of this measure: go back to here.
    forward: boolean;
    // A repeat barline at its right, and how many times the music returns.
    backwardTimes: number | null;
    // The passes this measure belongs to. Empty means every pass — a measure under no
    // ending bracket. `[1]` is a first-time bar, `[2]` a second-time bar.
    endings: number[];
};

// A guard, not a musical limit: a malformed or pathological repeat structure must not spin
// forever, and no real piece visits more measures than this.
const MAX_VISITS = 20000;

export function readMeasureRepeats(doc: Document): MeasureRepeats[] {
    const part = doc.documentElement?.getElementsByTagName("part")[0];
    if (!part) {
        return [];
    }
    // The bracket currently open, by the pass numbers it names. The file writes an ending
    // on the barline that opens the bracket and on the one that closes it; the bars in
    // between carry nothing, and read on their own they would play on every pass.
    let open: number[] | null = null;
    return Array.from(part.getElementsByTagName("measure")).map((measure) => {
        let forward = false;
        let backwardTimes: number | null = null;
        const endings: number[] = open ? [...open] : [];
        let closes = false;
        for (const barline of Array.from(measure.getElementsByTagName("barline"))) {
            for (const repeat of Array.from(barline.getElementsByTagName("repeat"))) {
                if (repeat.getAttribute("direction") === "forward") {
                    forward = true;
                } else if (repeat.getAttribute("direction") === "backward") {
                    const times = Number(repeat.getAttribute("times") ?? "2");
                    backwardTimes = Number.isFinite(times) && times > 1 ? times : 2;
                }
            }
            for (const ending of Array.from(barline.getElementsByTagName("ending"))) {
                // "1, 2" is a bracket covering both passes. The attribute is a printed
                // label, so it is written the way it is read aloud.
                for (const piece of (ending.getAttribute("number") ?? "").split(",")) {
                    const value = Number(piece.trim());
                    if (Number.isFinite(value) && value > 0 && !endings.includes(value)) {
                        endings.push(value);
                    }
                }
                const type = ending.getAttribute("type");
                if (type === "start") {
                    open = [...endings];
                } else if (type === "stop" || type === "discontinue") {
                    closes = true;
                }
            }
        }
        if (closes) {
            open = null;
        }
        return { forward, backwardTimes, endings };
    });
}

// The measures in the order they are performed, by printed index.
//
// A measure under an ending bracket is played only on the passes its bracket names, which
// is the whole point of a first-time bar. A measure under no bracket is played every time.
export function performanceOrder(measures: readonly MeasureRepeats[]): number[] {
    const order: number[] = [];
    // How many times each backward-repeat barline has sent us back already.
    const returns = new Map<number, number>();
    // Which pass through the current repeated section we are on, counting from one — and
    // which section that is. The pass belongs to the section, so a second repeated section
    // later in the piece starts counting again and its own first-time bar is played.
    let pass = 1;
    let section: number | null = null;
    let index = 0;
    let guard = 0;

    while (index < measures.length && guard++ < MAX_VISITS) {
        const measure = measures[index] as MeasureRepeats;
        // Arriving at a forward repeat we were not already inside starts a fresh count.
        // Arriving at the one we just jumped back to does not — that is the same section
        // coming round again, and resetting there would play the first-time bar every pass
        // and never reach the second-time bar at all.
        if (measure.forward && section !== index) {
            section = index;
            pass = 1;
        }
        const belongs = measure.endings.length === 0 || measure.endings.includes(pass);
        if (belongs) {
            order.push(index);
        }
        const times = measure.backwardTimes;
        if (belongs && times !== null) {
            const taken = returns.get(index) ?? 0;
            if (taken < times - 1) {
                returns.set(index, taken + 1);
                pass += 1;
                index = lastForwardAtOrBefore(measures, index);
                continue;
            }
        }
        index += 1;
    }
    return order;
}

// Where a backward repeat sends the music: the nearest forward repeat at or before it, or
// the top of the piece when the engraving writes none — which is what a repeat barline with
// no opening one means.
function lastForwardAtOrBefore(measures: readonly MeasureRepeats[], from: number): number {
    for (let index = from; index >= 0; index--) {
        if (measures[index]?.forward) {
            return index;
        }
    }
    return 0;
}
