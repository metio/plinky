// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useRef, useState } from "react";
import { audibleGain } from "../../../core/loudness";
import { isPreciseInput } from "../../../core/midi";
import { LENIENT_TOLERANCE, PRECISE_TOLERANCE } from "../../../core/rhythm";
import {
    CLAIM_MS,
    gradeRhythm,
    type RhythmVerdict,
    rhythmVerdictRating,
} from "../../../core/rhythmGrade";
import { MARK_COLOR, type RhythmMark, rhythmSvg } from "../../../core/rhythmNotation";
import { rhythmTempoPoints } from "../../../core/rhythmTempo";
import { TempoGraph } from "../ui/tempoGraph";
import {
    expectedOnsets,
    generateRhythm,
    patternMs,
    type RhythmPattern,
} from "../../../core/rhythmPattern";
import { useAudioEngine, usePrefsStore, useScheduler } from "../../contexts/services";
import { useMidiInput } from "../../contexts/midi";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";

// Read a rhythm and tap it back.
//
// Rhythm is graded everywhere else in Plinky as a by-product of playing pitches, which
// leaves nowhere to work on reading a rhythm by itself — and hides which of the two a
// wobbly run was. Here there is no pitch at all: one line, one sound, and the only
// question is when. Anything counts as a tap, because what is being tested is the
// timing and not the hand.
//
// One clock runs the whole thing. The scheduler's monotonic clock is the authority for
// both the moving cursor and the grading, and the audio clock is read once beside it so
// the clicks can be queued in the audio timeline they have to be queued in. Two clocks
// captured in the same tick are within a fraction of a millisecond of each other, which
// matters because the click is what the player is following: a pulse that drifted from
// the timeline being graded would mark everybody late by exactly that drift.

type Phase = "idle" | "counting" | "running" | "done";

const LEAD_MS = 250;
export const DEFAULT_RHYTHM_BPM = 80;

export function RhythmTrainer({
    level,
    bpm,
    // Injected so a story draws a fixed rhythm and a test can pick a known one.
    rng = Math.random,
}: {
    level: number;
    bpm: number;
    rng?: () => number;
}) {
    const scheduler = useScheduler();
    const audio = useAudioEngine();
    const prefsStore = usePrefsStore();

    const [pattern, _setPattern] = useState<RhythmPattern>(() => generateRhythm(level, rng));
    const [phase, setPhase] = useState<Phase>("idle");
    const [active, setActive] = useState<number | null>(null);
    const [verdict, setVerdict] = useState<RhythmVerdict | null>(null);

    // The run's own state, off React: a tap must be recorded at the instant it happens,
    // and a re-render between the press and the state landing would cost it its moment.
    const run = useRef<{ startMs: number; taps: number[]; precise: boolean } | null>(null);

    const beatMs = 60_000 / Math.max(1, bpm);
    const onsets = expectedOnsets(pattern, bpm);

    // A fresh rhythm whenever the level or the tempo the reader is working at changes,
    // rather than leaving the last level's pattern on screen under the new heading.
    const finish = useCallback(() => {
        const current = run.current;
        run.current = null;
        setActive(null);
        setPhase("done");
        if (current) {
            setVerdict(
                gradeRhythm(
                    onsets,
                    current.taps,
                    current.precise ? PRECISE_TOLERANCE : LENIENT_TOLERANCE,
                ),
            );
        }
    }, [onsets]);

    const start = useCallback(() => {
        audio.resume();
        const now = scheduler.now();
        const audioNow = audio.now();
        const countInMs = pattern.beatsPerBar * beatMs;
        const startMs = now + LEAD_MS + countInMs;
        run.current = { startMs, taps: [], precise: true };
        setVerdict(null);
        setPhase("counting");

        // Every click for the count-in and the run, queued once on the audio clock. The
        // pulse must not depend on a polling loop surviving a backgrounded tab: this is
        // two bars, and queueing it whole is both simpler and steadier. Queued whole, it
        // has to come off whole too: a restart mid-run or leaving the page would otherwise
        // leave the rest of the track sounding over the new count-in, or over nothing.
        const queued: (() => void)[] = [];
        if (audioNow !== null) {
            // Queued at zero gain when muted, like the metronome's own pulse: the whole
            // count-in and run go onto the audio clock in one go, so the grid has to exist
            // whether or not it can be heard.
            const gain = audibleGain(prefsStore.load(), 0.18) ?? 0;
            const beats = pattern.beatsPerBar * (pattern.bars + 1);
            const audioStart = audioNow + LEAD_MS / 1000;
            for (let beat = 0; beat < beats; beat++) {
                queued.push(
                    audio.click(
                        audioStart + (beat * beatMs) / 1000,
                        beat % pattern.beatsPerBar === 0 ? "accent" : "beat",
                        gain,
                    ),
                );
            }
        }

        const total = patternMs(pattern, bpm);
        const toRunning = scheduler.after(LEAD_MS + countInMs, () => setPhase("running"));
        // The window stays open past the last note so a late tap on it still counts as
        // late rather than as a miss — closing on the beat would grade the player's
        // hesitation as an absence.
        const toDone = scheduler.after(LEAD_MS + countInMs + total + 400, finish);
        return () => {
            scheduler.cancel(toRunning);
            scheduler.cancel(toDone);
            for (const cancel of queued) {
                cancel();
            }
        };
    }, [audio, beatMs, bpm, finish, pattern, prefsStore, scheduler]);

    const cancelRef = useRef<(() => void) | null>(null);
    const begin = () => {
        cancelRef.current?.();
        cancelRef.current = start();
    };
    useEffect(() => () => cancelRef.current?.(), []);

    const tap = useCallback(
        (precise: boolean) => {
            const current = run.current;
            if (!current) {
                return;
            }
            const at = scheduler.now() - current.startMs;
            // A tap during the count-in is somebody finding the pulse, not playing the
            // rhythm. It is too early to belong to the first note by the grader's own
            // reckoning, so counting it would report a spare tap and mark the reader down
            // for getting ready.
            if (at < -CLAIM_MS) {
                return;
            }
            current.taps.push(at);
            if (!precise) {
                current.precise = false;
            }
        },
        [scheduler],
    );

    // Every source of notes lands here — a MIDI piano, the computer keys, the on-screen
    // ones. The moment is taken from the scheduler when the handler runs rather than from
    // the event's own timestamp, because only the MIDI path carries a trustworthy one and
    // a run graded on two different clocks would be graded on neither.
    useMidiInput({
        // A rhythm is tapped back on whatever is to hand, the computer keys included.
        keys: true,
        onNoteOn: (event) => tap(isPreciseInput(event.device)),
    });

    // The space bar is the tap key, because it is the one a hand already resting on a
    // desk will find. Two things make it need handling here rather than falling out of
    // the button: the button that started the run still holds focus, so a space would
    // press *it* and restart the attempt half-way through — the exact thing somebody
    // reaching for the obvious key would hit; and a space scrolls the page. Both are
    // stopped. Held keys repeat at the system's rate, which would machine-gun taps, so a
    // repeat is not a tap — a rhythm is tapped, not leaned on.
    //
    // Piano keys are not handled here. They already arrive as notes through the funnel
    // above, and catching them twice would count every tap twice.
    useEffect(() => {
        if (phase !== "counting" && phase !== "running") {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== " " && event.key !== "Enter") {
                return;
            }
            event.preventDefault();
            if (!event.repeat) {
                tap(false);
            }
        };
        globalThis.addEventListener("keydown", onKeyDown);
        return () => globalThis.removeEventListener("keydown", onKeyDown);
    }, [phase, tap]);

    // The cursor, one frame at a time. It reads the clock rather than counting frames, so
    // a dropped frame moves it late instead of moving it wrong.
    useEffect(() => {
        if (phase !== "running") {
            return;
        }
        let handle = 0;
        const step = () => {
            const current = run.current;
            if (!current) {
                return;
            }
            const at = scheduler.now() - current.startMs;
            let index = -1;
            for (let note = 0; note < onsets.length; note++) {
                if ((onsets[note] as number) <= at + beatMs / 2) {
                    index = note;
                }
            }
            setActive(index < 0 ? null : index);
            handle = scheduler.frame(step);
        };
        handle = scheduler.frame(step);
        return () => scheduler.cancelFrame(handle);
    }, [phase, onsets, beatMs, scheduler]);

    const marks: RhythmMark[] | undefined = verdict
        ? verdict.hits.map((hit) => (hit === null ? "missed" : hit.rating))
        : undefined;

    return (
        <div className="space-y-4">
            <div
                className="text-ink"
                // The drawing is markup this component owns end to end: it is built by a
                // pure core function from a pattern this component generated, and no part
                // of it comes from anything a reader could supply.
                // biome-ignore lint/security/noDangerouslySetInnerHtml: core-generated SVG
                dangerouslySetInnerHTML={{
                    __html: rhythmSvg({
                        pattern,
                        marks,
                        activeNote: active,
                        label: m.rhythm_staff_label({ notes: onsets.length }),
                    }),
                }}
            />

            <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={begin} disabled={phase === "counting"}>
                    {phase === "done" ? m.rhythm_again() : m.rhythm_start()}
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => tap(false)}
                    disabled={phase === "idle" || phase === "done"}
                >
                    {m.rhythm_tap()}
                </Button>
                <p role="status" className="text-sm text-muted">
                    {phase === "counting"
                        ? m.rhythm_counting()
                        : phase === "running"
                          ? m.rhythm_listening()
                          : phase === "idle"
                            ? m.rhythm_ready()
                            : ""}
                </p>
            </div>

            {verdict && <Result verdict={verdict} />}
            {/* Where the pulse went, which the counts cannot say: a tap that is steadily a
                touch late and one that starts well and falls apart score the same and are
                nothing alike. The reference line is the tempo you SET rather than your own
                median — a line through the middle of a steadily-rushed attempt would hide
                exactly what is being practised. */}
            {verdict && <SpeedGraph verdict={verdict} onsets={onsets} tempo={bpm} />}
        </div>
    );
}

const VERDICT_CLASS = {
    perfect: "text-success",
    good: "text-warn",
    off: "text-danger",
} as const;

function SpeedGraph({
    verdict,
    onsets,
    tempo,
}: {
    verdict: RhythmVerdict;
    onsets: readonly number[];
    tempo: number;
}) {
    const points = rhythmTempoPoints(onsets, verdict.hits, tempo);
    if (points.length < 2) {
        return null;
    }
    return (
        <section className="space-y-1">
            <h3 className="text-sm font-medium text-muted">{m.rhythm_speed_heading()}</h3>
            <TempoGraph
                points={points}
                median={tempo}
                hotspots={[]}
                // Not a median: this is the tempo the player chose before the count-in.
                medianLabel={(value) => m.rhythm_speed_target({ bpm: value })}
                // The same colours the noteheads above carry, from the same map — a red dot
                // beside a red notehead has to mean the same thing.
                dotColor={(index) => {
                    const hit = verdict.hits[index];
                    return hit ? MARK_COLOR[hit.rating] : null;
                }}
            />
            <p className="text-xs text-muted">{m.rhythm_speed_hint()}</p>
        </section>
    );
}

function Result({ verdict }: { verdict: RhythmVerdict }) {
    const rating = rhythmVerdictRating(verdict);
    return (
        <div className="space-y-1" role="status">
            <p className={`text-sm font-medium ${VERDICT_CLASS[rating]}`}>
                {rating === "perfect"
                    ? m.rhythm_verdict_perfect()
                    : rating === "good"
                      ? m.rhythm_verdict_good()
                      : m.rhythm_verdict_off()}
            </p>
            <p className="text-xs text-muted">
                {m.rhythm_counts({
                    onTime: verdict.perfect + verdict.good,
                    total: verdict.total,
                })}
                {verdict.missed > 0 ? ` · ${m.rhythm_missed({ count: verdict.missed })}` : ""}
                {verdict.extra > 0 ? ` · ${m.rhythm_extra({ count: verdict.extra })}` : ""}
            </p>
        </div>
    );
}
