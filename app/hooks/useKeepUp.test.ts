// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOMINAL_BPM } from "../../core/elapsed";
import { listenStepMs } from "../../core/playback";
import { PLAYED_COLOR } from "../../core/scoreCanvas";
import { litHalos } from "../lib/scoreColor";
import { collectKeepUpSteps, useKeepUp } from "./useKeepUp";

// The painting reaches into OSMD's rendered SVG, which only exists in a real
// browser; stub the colour helpers so the hook's paint-tracking is observable in
// jsdom. highlightCursorNotes returns one painted part so a step counts as painted.
vi.mock("../lib/scoreColor", async (importOriginal) => ({
    highlightCursorNotes: () => [{ element: {}, prior: null }],
    litHalos: vi.fn(),
    followNotes: (await importOriginal<typeof import("../lib/scoreColor")>()).followNotes,
}));

// One voice at a position: a MIDI pitch on a staff (0 = right, 1 = left) with a
// written length in quarter notes, or a rest carrying only a length.
// staff omitted models a note whose engraved ParentStaff is undefined.
type Voice =
    | {
          midi: number;
          staff?: number;
          quarters?: number;
          tie?: "start" | "stop";
          // An ornament's note, on a voice entry of its own, so two graces are two
          // groups ahead of the beat rather than one grace chord.
          grace?: boolean;
      }
    | { rest: number };

// A cursor over a fixed sequence of positions, standing in for the OSMD graphic.
// EndReached turns true once the walk steps past the last position, so the
// upfront collection terminates.
function fakeOsmd(positions: Voice[][], onsets?: number[]) {
    let idx = 0;
    const cursor = {
        reset: () => {
            idx = 0;
        },
        show: () => {},
        hide: () => {},
        next: () => {
            idx += 1;
        },
        NotesUnderCursor: () =>
            (positions[idx] ?? []).map((voice) =>
                "rest" in voice
                    ? {
                          isRest: (): boolean => true,
                          halfTone: 0,
                          Length: { RealValue: voice.rest / 4 },
                      }
                    : {
                          isRest: (): boolean => false,
                          halfTone: voice.midi - 12,
                          // A tie's later note reports a tie whose start is another note.
                          ...(voice.tie === "stop" ? { NoteTie: { StartNote: {} } } : {}),
                          ...(voice.grace ? { IsGraceNote: true, ParentVoiceEntry: {} } : {}),
                          ParentStaff:
                              voice.staff === undefined
                                  ? undefined
                                  : { idInMusicSheet: voice.staff },
                          Length: { RealValue: (voice.quarters ?? 1) / 4 },
                      },
            ),
        get iterator() {
            return {
                EndReached: idx >= positions.length,
                // Each position a crotchet on from the last, so onsets advance the way a
                // real walk's do. A fake reporting the same onset everywhere would let a
                // caller reading the position pass while reading it wrongly.
                currentTimeStamp: { RealValue: onsets?.[idx] ?? idx * 0.25 },
            };
        },
    };
    return { cursor } as unknown as OpenSheetMusicDisplay;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe("collectKeepUpSteps", () => {
    it("lifts each position: the hand's pitches with length, and every note's length", () => {
        const osmd = fakeOsmd([
            [
                { midi: 60, staff: 0, quarters: 1 },
                { midi: 48, staff: 1, quarters: 2 },
            ],
            [{ rest: 1 }],
            [{ midi: 62, staff: 0, quarters: 1 }],
        ]);
        // The right hand catches only staff-0 pitches, but the beat length still
        // sees both hands (and the rest), so the clock advances with the notation.
        expect(collectKeepUpSteps(osmd, "right")).toEqual([
            {
                whole: 0,
                play: [{ pitch: 60, quarters: 1 }],
                accompany: [{ pitch: 48, quarters: 2 }],
                lengths: [1, 2],
                bpm: NOMINAL_BPM,
                stretch: 1,
                position: 0,
                advancesCursor: true,
            },
            {
                whole: 0.25,
                play: [],
                accompany: [],
                lengths: [1],
                bpm: NOMINAL_BPM,
                stretch: 1,
                position: 1,
                advancesCursor: true,
            },
            {
                whole: 0.5,
                play: [{ pitch: 62, quarters: 1 }],
                accompany: [],
                lengths: [1],
                bpm: NOMINAL_BPM,
                stretch: 1,
                position: 2,
                advancesCursor: true,
            },
        ]);
        // The left hand catches staff-1 pitches instead, accompanied by staff 0.
        expect(collectKeepUpSteps(osmd, "left")[0]).toEqual({
            whole: 0,
            play: [{ pitch: 48, quarters: 2 }],
            accompany: [{ pitch: 60, quarters: 1 }],
            lengths: [1, 2],
            bpm: NOMINAL_BPM,
            stretch: 1,
            position: 0,
            advancesCursor: true,
        });
    });

    it("dwells a beat until the next onset when the other voice moves on sooner", () => {
        const osmd = fakeOsmd(
            [[{ midi: 60, staff: 0 }], [{ midi: 48, staff: 1 }], [{ midi: 62, staff: 0 }]],
            [0, 0.25, 0.375],
        );
        expect(collectKeepUpSteps(osmd, "both").map((step) => Math.min(...step.lengths))).toEqual([
            1, 0.5, 1,
        ]);
    });

    it("asks for no re-strike of a tie's later note, but still dwells its length", () => {
        // The key is already down; demanding it again scores a held tie as a miss and has
        // the guide strike it twice. The self-paced matcher and Listen read the tie so.
        const steps = collectKeepUpSteps(
            fakeOsmd([[{ midi: 60, tie: "start" }], [{ midi: 60, tie: "stop" }], [{ midi: 62 }]]),
            "both",
        );
        expect(steps.map((step) => step.play.map((note) => note.pitch))).toEqual([[60], [], [62]]);
        expect(steps[1]?.lengths).toEqual([1]);
    });

    it("leaves a note with no engraved staff out of a single hand's beats, as self-paced does", () => {
        // A single-hand run owns only its own staff; a note the engraving gives no staff
        // can't be proven to be that hand's, so it is the other hand's to accompany — never
        // a beat the player must catch. Keep-up and the self-paced matcher agree here, so a
        // hand choice narrows both modes the same way.
        const osmd = fakeOsmd([[{ midi: 60, quarters: 1 }]]);
        const step = collectKeepUpSteps(osmd, "right")[0]!;
        expect(step.play).toEqual([]);
        expect(step.accompany).toEqual([{ pitch: 60, quarters: 1 }]);
        // A both-hands run still owns it — there is no other hand to hand it to.
        expect(collectKeepUpSteps(osmd, "both")[0]!.play).toEqual([{ pitch: 60, quarters: 1 }]);
    });

    it("leaves nothing to accompany in a both-hands run", () => {
        const osmd = fakeOsmd([
            [
                { midi: 60, staff: 0, quarters: 1 },
                { midi: 48, staff: 1, quarters: 1 },
            ],
        ]);
        const step = collectKeepUpSteps(osmd, "both")[0]!;
        expect(step.play).toEqual([
            { pitch: 60, quarters: 1 },
            { pitch: 48, quarters: 1 },
        ]);
        expect(step.accompany).toEqual([]);
    });
});

describe("useKeepUp", () => {
    it("signals markPainted when a run paints a step, so the next run wipes the trail", () => {
        // A keep-up run paints its window and leaves a green/red hit-miss trail but never
        // restores it; only the markPainted signal lets the surface re-render the trail
        // away before the next run. Without it, a stop-then-restart-in-place would leave
        // the prior run's colours on notes the new run has not reached.
        const osmd = fakeOsmd([[{ midi: 60, staff: 0 }], [{ midi: 62, staff: 0 }]]);
        const markPainted = vi.fn();
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: () => {}, silenceStrikes: () => {} },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted,
                onFinish: () => {},
            }),
        );

        result.current.start({ hand: "both", guideNotes: false, accompany: false });
        // Count-in is one bar (beatMs × beatsPerBar = 250 ms at 240 bpm), then the first
        // tick opens — and paints — the step under the cursor.
        vi.advanceTimersByTime(300);

        expect(markPainted).toHaveBeenCalled();
        result.current.stop();
    });

    it("colours the fresh noteheads after an in-place redraw, not the discarded ones", () => {
        const osmd = fakeOsmd([[{ midi: 60, staff: 0 }], [{ midi: 62, staff: 0 }]]);
        const redrawn = {} as SVGElement;
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: () => {}, silenceStrikes: () => {} },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted: () => {},
                onFinish: () => {},
            }),
        );
        act(() => result.current.start({ hand: "both", guideNotes: false, accompany: false }));
        // Past the count-in, the first beat is open and lit.
        act(() => vi.advanceTimersByTime(300));
        act(() => result.current.retarget(() => redrawn));
        vi.mocked(litHalos).mockClear();
        act(() => result.current.registerNote(60, performance.now()));
        expect(litHalos).toHaveBeenCalledWith([{ element: redrawn, color: PLAYED_COLOR }]);
        act(() => result.current.stop());
    });

    it("settles the section's last beat before a repeat wipes the section", () => {
        // On the tick that sends the run back, the beat just closed is the section's
        // last. Its verdict normally waits on the late-strike timer; landing after the
        // rewind's uncolouring it would leave that one note coloured on every pass, so
        // the rewind settles it first.
        const osmd = fakeOsmd(
            [[{ midi: 60, staff: 0 }], [{ midi: 62, staff: 0 }], [{ midi: 60, staff: 0 }]],
            [0, 0.25, 0],
        );
        const onRewind = vi.fn();
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: () => {}, silenceStrikes: () => {} },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted: () => {},
                onFinish: () => {},
                onRewind,
            }),
        );
        act(() => result.current.start({ hand: "both", guideNotes: false, accompany: false }));
        // Count-in, the first beat, the second; the third tick is the rewind.
        act(() => vi.advanceTimersByTime(300));
        act(() => vi.advanceTimersByTime(250));
        vi.mocked(litHalos).mockClear();
        act(() => vi.advanceTimersByTime(250));
        expect(onRewind).toHaveBeenCalledTimes(1);
        const rewoundAt = onRewind.mock.invocationCallOrder[0]!;
        const verdicts = vi.mocked(litHalos).mock.invocationCallOrder;
        expect(verdicts.length).toBeGreaterThan(0);
        expect(verdicts.every((at) => at < rewoundAt)).toBe(true);
        act(() => result.current.stop());
    });

    it("holds a position with graces for its written time, however quick the graces", () => {
        // Two graces of a sixteenth of a beat ahead of a crotchet, at 160 bpm: 23 ms
        // apiece, under the floor. The position after them still opens one crotchet after
        // this one does, where Listen and a graded run put it.
        const osmd = fakeOsmd([
            [
                { midi: 62, staff: 0, quarters: 0.0625, grace: true },
                { midi: 64, staff: 0, quarters: 0.0625, grace: true },
                { midi: 60, staff: 0, quarters: 1 },
            ],
            [{ midi: 65, staff: 0, quarters: 1 }],
        ]);
        const onPosition = vi.fn();
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: () => {}, silenceStrikes: () => {} },
                tempo: () => 160,
                beatsPerBar: 1,
                centerCursor: () => {},
                onPosition,
                markPainted: () => {},
                onFinish: () => {},
            }),
        );
        act(() => result.current.start({ hand: "both", guideNotes: false, accompany: false }));
        const beat = listenStepMs([1], 160);
        // A one-beat count-in, then the decorated position.
        act(() => vi.advanceTimersByTime(beat * 2 - 1));
        expect(onPosition).not.toHaveBeenCalledWith(0.25);
        act(() => vi.advanceTimersByTime(1));
        expect(onPosition).toHaveBeenLastCalledWith(0.25);
        act(() => result.current.stop());
    });

    it("surfaces the open beat's pitches for the keyboard, and clears them on stop", () => {
        // The keyboard lights "play now" from this; the matcher is stopped during keep-up,
        // so without the run surfacing its own beat the keys would freeze on a stale note.
        const osmd = fakeOsmd([[{ midi: 60, staff: 0 }], [{ midi: 62, staff: 0 }]]);
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: () => {}, silenceStrikes: () => {} },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted: () => {},
                onFinish: () => {},
            }),
        );

        act(() => result.current.start({ hand: "both", guideNotes: false, accompany: false }));
        // Count-in (250 ms) then the first tick opens the beat under the cursor.
        act(() => vi.advanceTimersByTime(300));
        expect(result.current.expected).toEqual([60]);
        // The next tick advances the lit beat with the clock.
        act(() => vi.advanceTimersByTime(250));
        expect(result.current.expected).toEqual([62]);

        act(() => result.current.stop());
        expect(result.current.expected).toEqual([]);
    });

    it("counts a strike a hair before or after the beat, and a wrong one as a miss", () => {
        const osmd = fakeOsmd([
            [{ midi: 60, staff: 0 }],
            [{ midi: 62, staff: 0 }],
            [{ midi: 64, staff: 0 }],
        ]);
        const onFinish = vi.fn();
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: () => {}, silenceStrikes: () => {} },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted: () => {},
                onFinish,
            }),
        );
        const now = () => performance.now();

        act(() => result.current.start({ hand: "both", guideNotes: false, accompany: false }));
        // Count-in 250 ms, then beats of 250 ms each: 60 at 250, 62 at 500, 64 at 750.
        act(() => vi.advanceTimersByTime(250));
        // The first beat's note, struck late: 30 ms after the second beat opened.
        act(() => vi.advanceTimersByTime(280));
        act(() => result.current.registerNote(60, now()));
        // The third beat's note, struck early: 40 ms before its beat.
        act(() => vi.advanceTimersByTime(180));
        act(() => result.current.registerNote(64, now()));
        // The second beat's note never comes; let the run play out and settle.
        act(() => vi.advanceTimersByTime(1000));

        expect(onFinish).toHaveBeenCalled();
        expect(result.current.result).toMatchObject({ inTime: 2, total: 3 });
    });

    it("keeps a short grace open for its whole late window, whatever the beat before queued", () => {
        // The beat before the grace closes and queues its settle a window later. The grace
        // dwells only 40 ms, so by then it has closed too, and its own window runs on past
        // that settle. A grace struck 80 ms late is inside its window and must count.
        const osmd = fakeOsmd([
            [{ midi: 60, staff: 0, quarters: 1 }],
            [
                { midi: 62, staff: 0, quarters: 0.0625, grace: true },
                { midi: 64, staff: 0, quarters: 1 },
            ],
        ]);
        const onFinish = vi.fn();
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: () => {}, silenceStrikes: () => {} },
                tempo: () => 160,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted: () => {},
                onFinish,
            }),
        );
        const now = () => performance.now();
        const beat = listenStepMs([1], 160);

        act(() => result.current.start({ hand: "both", guideNotes: false, accompany: false }));
        // The count-in, then the first beat opens: strike it on the beat.
        act(() => vi.advanceTimersByTime(beat));
        act(() => result.current.registerNote(60, now()));
        // It closes one beat later and the grace opens; the grace closes 40 ms on and the
        // beat it decorates opens, which is struck on time.
        act(() => vi.advanceTimersByTime(beat + 40));
        act(() => result.current.registerNote(64, now()));
        // The grace, 80 ms after it closed — past the first beat's queued settle, inside
        // the grace's own window.
        act(() => vi.advanceTimersByTime(80));
        act(() => result.current.registerNote(62, now()));
        act(() => vi.advanceTimersByTime(2000));

        expect(onFinish).toHaveBeenCalled();
        expect(result.current.result).toMatchObject({ inTime: 3, total: 3 });
    });

    it("hands the synth the device a strike came from, so a piano is not doubled", () => {
        const osmd = fakeOsmd([[{ midi: 60, staff: 0 }]]);
        const playNote = vi.fn();
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote, silenceStrikes: () => {} },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted: () => {},
                onFinish: () => {},
            }),
        );
        act(() => result.current.start({ hand: "both", guideNotes: false, accompany: false }));
        act(() => vi.advanceTimersByTime(300));
        act(() => result.current.registerNote(60, performance.now(), "Yamaha P-125"));
        expect(playNote).toHaveBeenCalledWith(60, { device: "Yamaha P-125" });
        act(() => result.current.stop());
    });

    it("plays the other hand as accompaniment in a duet run", () => {
        const osmd = fakeOsmd([
            [
                { midi: 60, staff: 0 },
                { midi: 48, staff: 1 },
            ],
        ]);
        const played: number[] = [];
        const { result } = renderHook(() =>
            useKeepUp({
                getOsmd: () => osmd,
                synth: { playNote: (note) => played.push(note), silenceStrikes: () => {} },
                tempo: () => 240,
                beatsPerBar: 1,
                centerCursor: () => {},
                markPainted: () => {},
                onFinish: () => {},
            }),
        );

        // Practise the right hand with the guide off but the duet on.
        result.current.start({ hand: "right", guideNotes: false, accompany: true });
        vi.advanceTimersByTime(300);

        // The left hand (48) sounds as accompaniment; the right hand (60, yours to play) does not.
        expect(played).toContain(48);
        expect(played).not.toContain(60);
        result.current.stop();
    });

    describe("stopping", () => {
        // A right-hand run over a two-hand position: C4 yours, C3 the duet's, both long
        // enough to still be ringing when the stop comes.
        const duetOsmd = () =>
            fakeOsmd([
                [
                    { midi: 60, staff: 0, quarters: 4 },
                    { midi: 48, staff: 1, quarters: 4 },
                ],
                [{ midi: 62, staff: 0, quarters: 4 }],
            ]);
        const mountRun = (osmd = duetOsmd()) => {
            const playNote = vi.fn();
            const silenceStrikes = vi.fn();
            const onFinish = vi.fn();
            const view = renderHook(() =>
                useKeepUp({
                    getOsmd: () => osmd,
                    synth: { playNote, silenceStrikes },
                    tempo: () => 240,
                    beatsPerBar: 1,
                    centerCursor: () => {},
                    markPainted: () => {},
                    onFinish,
                }),
            );
            return { playNote, silenceStrikes, onFinish, ...view };
        };
        const ownersOf = (playNote: ReturnType<typeof vi.fn>) =>
            playNote.mock.calls.map(([, options]) => (options as { owner?: symbol }).owner);

        it("strikes the guide and the duet under one owner of its own", () => {
            const { result, playNote } = mountRun();
            act(() => result.current.start({ hand: "right", guideNotes: true, accompany: true }));
            act(() => vi.advanceTimersByTime(300));
            expect(playNote.mock.calls.map(([note]) => note).sort()).toEqual([48, 60]);
            const owners = new Set(ownersOf(playNote));
            expect(owners.size).toBe(1);
            expect(typeof [...owners][0]).toBe("symbol");
            act(() => result.current.stop());
        });

        it("takes back the notes it struck when the run is stopped", () => {
            const { result, playNote, silenceStrikes } = mountRun();
            act(() => result.current.start({ hand: "right", guideNotes: true, accompany: true }));
            act(() => vi.advanceTimersByTime(300));
            const [owner] = ownersOf(playNote);
            act(() => result.current.stop());
            expect(silenceStrikes).toHaveBeenCalledWith(owner);
        });

        it("lets its last notes ring when the run plays to its end", () => {
            const { result, silenceStrikes, onFinish } = mountRun();
            act(() => result.current.start({ hand: "right", guideNotes: true, accompany: true }));
            act(() => vi.advanceTimersByTime(10_000));
            expect(onFinish).toHaveBeenCalled();
            // Leaving the stage after the result stops the run again, which is not a request
            // for silence: the run was already over.
            act(() => result.current.stop());
            expect(silenceStrikes).not.toHaveBeenCalled();
        });

        it("echoes the player's own strike under no owner, so a stop leaves it", () => {
            const { result, playNote } = mountRun();
            act(() => result.current.start({ hand: "right", guideNotes: false, accompany: false }));
            act(() => vi.advanceTimersByTime(300));
            act(() => result.current.registerNote(60, performance.now()));
            expect(playNote).toHaveBeenCalledWith(60, { device: undefined });
            act(() => result.current.stop());
        });

        it("gives each run its own owner, so one's stop leaves the other's notes", () => {
            const first = mountRun();
            const second = mountRun();
            for (const run of [first, second]) {
                act(() =>
                    run.result.current.start({ hand: "right", guideNotes: true, accompany: true }),
                );
            }
            act(() => vi.advanceTimersByTime(300));
            const [firstOwner] = ownersOf(first.playNote);
            const [secondOwner] = ownersOf(second.playNote);
            expect(firstOwner).not.toBe(secondOwner);
            act(() => first.result.current.stop());
            expect(first.silenceStrikes).toHaveBeenCalledWith(firstOwner);
            expect(second.silenceStrikes).not.toHaveBeenCalled();
            act(() => second.result.current.stop());
        });
    });

    it("hands back the same object across a render that changes nothing", () => {
        const osmd = fakeOsmd([[{ midi: 60, staff: 0 }]]);
        const options = {
            getOsmd: () => osmd,
            synth: { playNote: () => {}, silenceStrikes: () => {} },
            tempo: () => 240,
            beatsPerBar: 1,
            centerCursor: () => {},
            markPainted: () => {},
            onFinish: () => {},
        };
        const { result, rerender } = renderHook(() => useKeepUp(options));
        const before = result.current;
        rerender();
        expect(result.current).toBe(before);
    });
});
