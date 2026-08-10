// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// How closely a run followed the expression the score asks for: the loudness shape
// the dynamics mark out, and the note lengths the articulations mark out.
//
// This is a different question from every dimension already graded. Accuracy asks
// whether the right keys went down, timing whether they went down on the beat, flow
// whether the run kept moving, and the existing `dynamics` figure measures *evenness*
// — how uniformly the player struck, which is the opposite of following a written
// crescendo. None of them notices a piece marked pianissimo played fortissimo
// throughout, or a page of staccato played legato.
//
// Two rules shape the scoring:
//
// **Loudness is graded as a shape, never as a level.** A MIDI keyboard's velocity
// depends on the instrument, the player's touch and the room; the score's dynamic is
// a musical instruction, not a target number. So the two sequences are compared by
// correlation, which asks "did you play louder where the score says louder" and not
// "did you hit 96" — multiplying every played velocity by the same factor leaves the
// figure untouched.
//
// **A dimension with nothing to say scores nothing at all.** A score with one
// unchanging dynamic cannot be followed or missed, an input that reports no real key
// velocity cannot be judged on loudness, and an input that reports no key release
// cannot be judged on length. Each half returns null rather than a flattering 100.

export type ExpressionNote = {
    // What the player did: the struck velocity, and how long the key was actually
    // held. `heldMs` is absent for an input with no key release to report.
    velocity: number;
    heldMs?: number;
    // What the score asked for at that position: the standing dynamic with any accent
    // applied (null when the score marks no dynamic), and the length the note is meant
    // to sound in milliseconds at the run's tempo.
    expectedVelocity: number | null;
    expectedHoldMs: number;
};

export type ExpressionSummary = {
    // How well the loudness followed the written dynamics, 0..100, or null when the
    // score marks no dynamic changes or the input reports no real velocity.
    dynamics: number | null;
    // How well the note lengths followed the written articulations, 0..100, or null
    // when the input reports no key releases.
    articulation: number | null;
    // The two above averaged over whichever were measurable.
    score: number;
};

// Below this many usable notes a figure is noise rather than a reading — a two-note
// correlation is either 100 or 0 and means neither.
const MIN_NOTES = 4;

// A played length within this fraction of the written one counts as fully right. Two
// pianists playing the same staccato quarter differ by more than a metronome tick,
// and a grade that demanded the exact figure would report a fault in every human run.
const LENGTH_TOLERANCE = 0.25;

function mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// How closely two sequences rise and fall together, as a correlation in -1..1, or
// null when either has no variation at all and so no shape to correlate. This is the
// scale-invariant comparison the dynamics reading needs: multiplying every played
// velocity by the same factor leaves it unchanged, which is what "graded as a shape,
// never as a level" means in arithmetic.
function correlation(left: number[], right: number[]): number | null {
    const leftMean = mean(left);
    const rightMean = mean(right);
    let covariance = 0;
    let leftVariance = 0;
    let rightVariance = 0;
    for (const [index, value] of left.entries()) {
        const a = value - leftMean;
        const b = (right[index] ?? 0) - rightMean;
        covariance += a * b;
        leftVariance += a * a;
        rightVariance += b * b;
    }
    if (leftVariance === 0 || rightVariance === 0) {
        return null;
    }
    return covariance / Math.sqrt(leftVariance * rightVariance);
}

function dynamicsScore(notes: ExpressionNote[]): number | null {
    const usable = notes.filter((note) => note.expectedVelocity !== null);
    if (usable.length < MIN_NOTES) {
        return null;
    }
    const shape = correlation(
        usable.map((note) => note.expectedVelocity as number),
        usable.map((note) => note.velocity),
    );
    // No written change to follow, or an input that strikes every note identically:
    // either way there is nothing here to be right or wrong about.
    if (shape === null) {
        return null;
    }
    // A run following the shape exactly scores 100 and one inverting it scores 0, so a
    // run that simply ignores the dynamics lands in the middle — playing flat through a
    // crescendo is a missed instruction, not a wrong note.
    return ((shape + 1) / 2) * 100;
}

function articulationScore(notes: ExpressionNote[]): number | null {
    const usable = notes.filter(
        (note) => note.heldMs !== undefined && note.heldMs > 0 && note.expectedHoldMs > 0,
    );
    if (usable.length < MIN_NOTES) {
        return null;
    }
    // Scored per note as a ratio rather than in milliseconds, so a run taken slower
    // than written is judged on its shaping and not on its tempo.
    const total = usable.reduce((sum, note) => {
        const ratio = (note.heldMs as number) / note.expectedHoldMs;
        const error = Math.abs(Math.log2(ratio));
        // A ratio inside the tolerance is fully right; beyond it the score falls away
        // over one further doubling, so twice or half the written length still reads
        // as an attempt rather than as nothing.
        return sum + Math.max(0, Math.min(1, 1 - (error - LENGTH_TOLERANCE)));
    }, 0);
    return (total / usable.length) * 100;
}

// The expressive reading of a run, or null when neither half could be measured — an
// unmarked score played on a computer keyboard has no expression to grade, and
// saying so is more honest than awarding it full marks.
export function summarizeExpression(notes: ExpressionNote[]): ExpressionSummary | null {
    const dynamics = dynamicsScore(notes);
    const articulation = articulationScore(notes);
    const measured = [dynamics, articulation].filter((value): value is number => value !== null);
    if (measured.length === 0) {
        return null;
    }
    return {
        dynamics: dynamics === null ? null : Math.round(dynamics),
        articulation: articulation === null ? null : Math.round(articulation),
        score: Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length),
    };
}
