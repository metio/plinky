// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The marks that belong to a stretch of music rather than to one note, read from the file.
//
// A dynamic, a pedal line, an 8va bracket and a slur all mean "from here to there", and all
// four were previously lifted out of the engraver's object graph — which reports them in
// four different shapes, none of them documented, on classes the shipped bundle renames to
// single letters. Here they come off the document, where they are four instances of one
// idea: something written at a position, standing until something else ends it.

import { child, text } from "./musicxmlDom";
import type { DynamicPoint } from "./dynamics";
import { DEFAULT_VELOCITY } from "./expression";
import { type GlissandoSpan, readGlissandos } from "./glissando";
import type { PedalSpan, SoftSpan } from "./pedal";
import { readTremolos, type TremoloSpan } from "./tremolo";
import type { SlurSpan } from "./slur";
import {
    readTimeline,
    type XmlBar,
    type XmlKeyPoint,
    type XmlNote,
    type XmlTimeline,
} from "./musicxmlTimeline";

// The loudness each written dynamic asks for, as a MIDI velocity. The values a sequencer
// conventionally uses, which is also the range the app's own default sits in.
const DYNAMIC_VELOCITY: Record<string, number> = {
    pppp: 10,
    ppp: 16,
    pp: 33,
    p: 49,
    mp: 64,
    mf: 80,
    f: 96,
    ff: 112,
    fff: 126,
    ffff: 127,
    // The accented ones are a loud attack rather than a standing level, but they are
    // written where a level would be, and reading them as loud is much closer than
    // ignoring them.
    sf: 112,
    sfz: 112,
    fz: 112,
    rf: 96,
    rfz: 96,
    fp: 96,
};

// The arches, paired by the number the file gives them.
//
// Pairing by number rather than by order is what lets two arches overlap — one per hand, or
// a phrase inside a phrase — without closing each other. A file that numbers nothing gets
// "1" for everything, which is the single-arch case and pairs correctly.
export function slurSpans(notes: readonly XmlNote[]): SlurSpan[] {
    const spans: SlurSpan[] = [];
    // Open arches, keyed by number AND staff: the file numbers slurs per part, so a
    // right-hand slur 1 and a left-hand slur 1 can be open at once, and each closes on
    // its own staff.
    const open = new Map<string, { from: number; staff: number }>();
    const key = (number: string, staff: number) => `${staff}:${number}`;
    for (const note of notes) {
        for (const number of note.marks.slurStarts) {
            if (!open.has(key(number, note.staffId))) {
                open.set(key(number, note.staffId), { from: note.whole, staff: note.staffId });
            }
        }
        for (const number of note.marks.slurStops) {
            const opened = open.get(key(number, note.staffId));
            if (opened !== undefined) {
                spans.push({ from: opened.from, to: note.whole, staff: opened.staff });
                open.delete(key(number, note.staffId));
            }
        }
    }
    // An arch the engraving opens and never closes joins to the last note it opened over.
    // Dropping it would play the phrase detached, which is silent as failures go.
    const last = notes.at(-1)?.whole ?? 0;
    for (const { from, staff } of open.values()) {
        spans.push({ from, to: Math.max(from, last), staff });
    }
    return spans;
}

// Everything written as a `<direction>`: the dynamics, the pedal, the octave lines.
//
// The onsets are the timeline's, stamped as it walked. A direction sits inside a measure
// between the notes it applies from, and working out where that is means following
// divisions, backups, chord notes that do not advance and grace notes that take no time —
// so it is done once, where the notes are placed, rather than again here.
export type XmlDirections = {
    dynamics: DynamicPoint[];
    pedals: PedalSpan[];
    softs: SoftSpan[];
};

export function readDirections(timeline: XmlTimeline): XmlDirections {
    const dynamics: DynamicPoint[] = [];
    const pedals: PedalSpan[] = [];
    // Where the soft pedal is down. Its own list rather than a pedal span, because it does
    // not hold anything — it changes how a note is struck, which is a different question
    // from how long one rings.
    const softs: SoftSpan[] = [];
    // What is currently open. One object rather than a handful of variables, so the
    // per-direction reader below can be a plain function instead of a closure over this one.
    const open: OpenSpans = {
        pedal: null,
        soft: null,
        end: timeline.end,
        volume: DEFAULT_VELOCITY,
    };

    for (const { element, whole } of timeline.directions) {
        readDirection(element, whole, { dynamics, pedals, softs }, open);
    }

    // A line the engraving opens and never closes runs to the end of the music, rather than
    // being dropped — dropping it un-pedals the rest of the piece silently.
    if (open.pedal !== null) {
        pedals.push({
            from: open.pedal.at,
            to: Math.max(open.pedal.at, open.end),
            kind: open.pedal.kind,
        });
    }
    if (open.soft !== null) {
        softs.push({ from: open.soft, to: Math.max(open.soft, open.end) });
    }
    return { dynamics, pedals, softs };
}

type OpenSpans = {
    pedal: { at: number; kind: "sustain" | "sostenuto" } | null;
    // Where the soft pedal went down, if it is still down.
    soft: number | null;
    end: number;
    // The loudness in force, so a hairpin knows what it is swelling from.
    volume: number;
};

function readDirection(direction: Element, at: number, out: XmlDirections, open: OpenSpans): void {
    // The soft pedal has no element of its own in MusicXML: it is written in words, the way
    // rit. is, and released by "tre corde". 59 pieces in the catalogue ask for it. Under it
    // the hammers strike fewer strings, so notes are gentler and slightly veiled — the
    // gentling is what carries here.
    //
    // Read once for the whole direction rather than inside the loop below: the words are a
    // property of the direction, and a direction carrying two direction-types would open the
    // span twice.
    const said = wordsOf(direction);
    if (said) {
        if (SOFT_ON.test(said) && open.soft === null) {
            open.soft = at;
        } else if (open.soft !== null && SOFT_OFF.test(said)) {
            out.softs.push({ from: open.soft, to: at });
            open.soft = null;
        }
    }
    for (const type of Array.from(direction.getElementsByTagName("direction-type"))) {
        const dynamic = child(type, "dynamics");
        if (dynamic) {
            for (const mark of Array.from(dynamic.children)) {
                const volume = DYNAMIC_VELOCITY[mark.tagName];
                if (volume !== undefined) {
                    out.dynamics.push({ whole: at, volume, ramp: false });
                    open.volume = volume;
                }
            }
        }
        const wedge = child(type, "wedge");
        if (wedge) {
            const kind = wedge.getAttribute("type");
            // A hairpin's start is where the loudness begins to slide, and the mark it
            // slides TOWARD is whatever is written next — which is why this is a ramp flag
            // on a point rather than a span of its own.
            //
            // It carries the loudness the swell begins FROM, which is whatever was already
            // in force. A hairpin does not itself say how loud anything is; it says the
            // loudness changes from here. Where nothing precedes it the swell still has to
            // start somewhere, and the default is where a player would start.
            if (kind === "crescendo" || kind === "diminuendo") {
                out.dynamics.push({ whole: at, volume: open.volume, ramp: true });
            }
        }
        const pedal = child(type, "pedal");
        if (pedal) {
            const kind = pedal.getAttribute("type");
            // Which pedal the mark is for. `sostenuto` is the middle one, and reading it as
            // a damper span — which is what happened before — holds the whole texture where
            // the score asked for one caught chord under a line played dry above it.
            const which = kind === "sostenuto" ? "sostenuto" : "sustain";
            if ((kind === "start" || kind === "sostenuto") && open.pedal === null) {
                open.pedal = { at, kind: which };
            } else if (open.pedal !== null && (kind === "stop" || kind === "change")) {
                out.pedals.push({ from: open.pedal.at, to: at, kind: open.pedal.kind });
                // A change lifts and presses on the spot — the span ends and another begins
                // at the same moment, which is what clears the old harmony. A stop just
                // ends. A change keeps the pedal it was already on.
                open.pedal = kind === "change" ? { at, kind: open.pedal.kind } : null;
            }
        }
        // An octave line (8va, 8vb, 15ma) is deliberately not read. MusicXML writes the
        // SOUNDING pitch in <pitch>; the line only says where the engraver draws the notes,
        // and the engraving applies it to the drawing alone. Reading it as a shift and
        // adding it to the pitch put every passage under one an octave out — and asked the
        // player to play what the page does not say.
    }
}

// What a `<beat-unit>` is worth in crotchets, so a metronome mark written in anything else
// can be said in the unit everything downstream counts in.
const BEAT_UNIT_QUARTERS: Record<string, number> = {
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    "16th": 0.25,
};

// Where the piece changes speed, in crotchets per minute, at the moment it changes.
//
// The engraver could only answer this per measure — it resolves a tempo onto the bar the
// mark sits in — so a mark written mid-bar took effect at the barline before it. Thirteen
// files in a hundred in the catalogue write one, and in every one of them a rit. or an
// a tempo arrived early by up to a bar.
export function readTempoPoints(timeline: XmlTimeline): TempoPoint[] {
    const points: TempoPoint[] = [];
    // The tempo a resume ("a tempo") goes back to: the last one the score actually STATED,
    // which is not the last point recorded — a ramp's own opening point holds the tempo it
    // is leaving, and going back to that would restore nothing.
    let stated: number | null = null;
    // An open rit. or accel., and where it would land if the score never says. A ramp is
    // closed by the next thing that states a tempo, and only then is its landing point
    // known.
    let ramp: { drift: number } | null = null;

    // A tempo the score states outright. It closes any open ramp simply by being the next
    // point after it, which is what the ramp interpolates toward.
    const state = (whole: number, bpm: number) => {
        points.push({ whole, bpm });
        stated = bpm;
        ramp = null;
    };

    for (const { element, whole } of timeline.directions) {
        // `<sound tempo>` is the sounding instruction and is always in crotchets; a
        // `<metronome>` is the printed one and says which note it is counting.
        const sound = element.tagName === "sound" ? element : child(element, "sound");
        const marked = Number(sound?.getAttribute("tempo") ?? Number.NaN);
        if (Number.isFinite(marked) && marked > 0) {
            state(whole, marked);
            continue;
        }
        const metronome = child(element, "metronome");
        if (!metronome) {
            // No number here, so this is where a written instruction can be: rit., accel.,
            // a tempo. Only meaningful once the piece has stated a tempo to move away from —
            // a ramp from a guessed starting tempo would be inventing the piece's speed.
            const words = wordsOf(element);
            const from = stated;
            if (words && from !== null) {
                if (RESUME.test(words)) {
                    // The ramp has to land somewhere before the tempo comes back, or it
                    // never happened: a rit. straight into "a tempo" would interpolate from
                    // the old tempo to the same old tempo. So the drift is placed at this
                    // instant and the restored tempo immediately after it — the ramp slides
                    // into the resume, and from here the tempo is the stated one again.
                    if (ramp) {
                        points.push({ whole, bpm: ramp.drift });
                    }
                    state(whole, from);
                } else if (!ramp && (SLOWER.test(words) || FASTER.test(words))) {
                    // Opens a ramp FROM the tempo in force. Engravings write "rit." and then
                    // "poco rit." a bar later, meaning one give in the pulse — a second ramp
                    // inside the first would compound into a halt.
                    const slower = SLOWER.test(words);
                    points.push({ whole, bpm: from, ramp: true });
                    ramp = { drift: from * (slower ? 1 - DRIFT : 1 + DRIFT) };
                }
            }
            continue;
        }
        const perMinute = Number(text(child(metronome, "per-minute")));
        const unit = BEAT_UNIT_QUARTERS[text(child(metronome, "beat-unit"))] ?? 1;
        // A dot on the beat unit makes it half as long again — a dotted crotchet in 6/8.
        const dotted = metronome.getElementsByTagName("beat-unit-dot").length > 0 ? 1.5 : 1;
        if (Number.isFinite(perMinute) && perMinute > 0) {
            state(whole, perMinute * unit * dotted);
        }
    }
    // A ramp the score never resolves — a rit. into a repeat, or into the final barline —
    // still has to go somewhere, or the mark does nothing at all. It slides to the end.
    if (ramp) {
        points.push({ whole: timeline.end, bpm: (ramp as { drift: number }).drift });
    }
    return points;
}

export type TempoPoint = {
    whole: number;
    // Crotchets per minute, whatever note the mark was written against.
    bpm: number;
    // Whether the tempo SLIDES from here to whatever is stated next, rather than holding.
    //
    // The same shape a hairpin takes in the dynamics, and for the same reason: a rit. says
    // "get slower" without saying how slow, and what it is heading for is whatever the score
    // states next — an "a tempo", a new metronome mark, or nothing at all. So the mark opens
    // a ramp and the following point closes it, and tempoAt interpolates between them.
    ramp?: boolean;
};

// How far a rit. or an accel. moves the tempo when the score never says where it lands.
//
// Most of the time it does not say: a rit. before a repeat, an accel. into a phrase. The
// value is a judgement, not a reading — a fifth either way is enough to hear as a genuine
// give in the pulse without turning a bar into a different tempo. A score that DOES state
// its target overrides this entirely, because then it is a reading.
const DRIFT = 0.2;

// The words a score uses for "get slower", "get faster", and "stop doing that". Matched on
// the opening so the ordinary abbreviations are covered — rit., ritard., ritardando — since
// engravings write whichever they like.
//
// `rit(?!en)` on purpose: ritenuto is a sudden drop to a new tempo rather than a slide
// toward one, so spreading it over the following bars would give the score something it does
// not ask for. ritard./ritardando still match.
// The soft pedal, which MusicXML writes in words rather than as an element.
const SOFT_ON = /^(una corda|u\.?c\.?$|con sordina)/i;
const SOFT_OFF = /^(tre corde|tutte le corde|senza sordina)/i;

const SLOWER = /^(rit(?!en)|rall|allarg|slow)/i;
const FASTER = /^(accel|string|stretto|piu mosso|più mosso)/i;
const RESUME = /^(a tempo|tempo (i|1|prim))/i;

// The text of a written instruction — rit., a tempo — trimmed, since one score writes
// "rit." and the next "Rit ".
function wordsOf(element: Element): string | null {
    const words = Array.from(element.getElementsByTagName("words"))
        .map((one) => text(one))
        .join(" ")
        .trim();
    return words.length > 0 ? words : null;
}

// The tempo in force at a printed position, or null where the piece has stated none yet.
export function tempoAt(points: readonly TempoPoint[], whole: number): number | null {
    let index = -1;
    for (const [at, point] of points.entries()) {
        if (point.whole <= whole + TEMPO_EPSILON) {
            index = at;
        }
    }
    const current = points[index];
    if (!current) {
        return null;
    }
    const next = points[index + 1];
    // A stated tempo holds until the next one. A ramp — a rit. or an accel. — slides toward
    // whatever is stated next, so the pulse actually gives rather than stepping down at the
    // barline after the word.
    if (!current.ramp || !next) {
        return current.bpm;
    }
    const span = next.whole - current.whole;
    if (span <= 0) {
        return current.bpm;
    }
    const travelled = Math.min(1, Math.max(0, (whole - current.whole) / span));
    return current.bpm + (next.bpm - current.bpm) * travelled;
}

// Printed onsets are exact binary fractions in every ordinary metre, but a triplet is a
// third, so a mark written at one needs room for a rounded value.
const TEMPO_EPSILON = 1e-9;

// The key in force at a point in the piece.
//
// A piece can change key part way through — 13% of the catalogue does — and the key is what
// spells an ornament's auxiliary note: a trill in the new key spelled from the old one
// sounds a note the score does not contain. Before this, the first signature stood for the
// whole piece.
//
// Zero for a piece with no signature at all, and for anything before the first one, which is
// C major either way.
export function fifthsAt(keys: readonly XmlKeyPoint[], whole: number): number {
    let current = 0;
    for (const point of keys) {
        if (point.whole > whole + TEMPO_EPSILON) {
            break;
        }
        current = point.fifths;
    }
    return current;
}

// The key signature the piece opens in, as its count of sharps (positive) or flats.
export function readFifths(doc: Document): number {
    const fifths = doc.documentElement?.getElementsByTagName("fifths")[0];
    const value = Number(text(fifths));
    return Number.isFinite(value) ? value : 0;
}

// Everything a surface needs to know about a score's markings, read once.
//
// The readers above each answer one question, which is right for testing them and wrong
// for using them: a caller wants the whole set, and asking for it in five calls means five
// chances to forget one. The dynamics reader was forgotten for years in exactly that way.
export type ScoreMarks = {
    slurs: SlurSpan[];
    pedals: PedalSpan[];
    dynamics: DynamicPoint[];
    tempi: TempoPoint[];
    // Each bar's start and metre, for the weighting a bar gives its own beats.
    bars: XmlBar[];
    // Where the soft pedal is down. Notes struck under it are gentler.
    softs: SoftSpan[];
    // Where the piece shakes a note or rocks between two, and where it sweeps the keys.
    // Both are shorthand on the page for a figure that has to be spelled out to sound.
    tremolos: TremoloSpan[];
    glissandos: GlissandoSpan[];
    // The opening key, for anything that shows one key for the whole piece.
    fifths: number;
    // Every key the piece is in, with where each takes effect — what an ornament reads to
    // spell its auxiliary note. See fifthsAt.
    keys: XmlKeyPoint[];
};

// A score with nothing written on it — which is also the honest answer for a caller that
// has no document to read, rather than a reason to branch at every use.
export const NO_SCORE_MARKS: ScoreMarks = {
    slurs: [],
    pedals: [],
    dynamics: [],
    tempi: [],
    bars: [],
    softs: [],
    tremolos: [],
    glissandos: [],
    fifths: 0,
    keys: [],
};

export function readScoreMarks(doc: Document | null): ScoreMarks {
    if (!doc) {
        return NO_SCORE_MARKS;
    }
    const timeline = readTimeline(doc);
    const directions = readDirections(timeline);
    return {
        slurs: slurSpans(timeline.notes),
        pedals: directions.pedals,
        dynamics: directions.dynamics,
        tempi: readTempoPoints(timeline),
        softs: directions.softs,
        tremolos: readTremolos(timeline.notes),
        glissandos: readGlissandos(timeline.notes),
        bars: timeline.bars,
        fifths: readFifths(doc),
        keys: timeline.keys,
    };
}
