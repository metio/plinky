// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type React from "react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_THEME } from "../../../core/keyboardTheme";
import { pitchClass } from "../../../core/midi";
import type { NoteLabels } from "../../../core/prefs";
import { m } from "../../paraglide/messages.js";
import { BLACK_KEY, KEYBED_WELL, WHITE_KEY } from "./keyboardStyles";

const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
function isWhite(note: number): boolean {
    return WHITE_PITCH_CLASSES.includes(((note % 12) + 12) % 12);
}

// The widest a white key is allowed to grow. The keys divide the container width
// evenly (flex-1), so on a wide surface a few-key piece would otherwise stretch each
// key squat and unpiano-like. Capping the keyboard to this per white key — and
// centring it — keeps keys near the tall ~1:3 proportion of a real keyboard (the well
// is ~144px tall) however few notes a piece spans, matching the exported video's look.
// A narrow phone stays under the cap, so its keys fill the width as before.
const MAX_WHITE_KEY_PX = 44;

// A tap's loudness from where the key is struck: near the pivot (top) is soft, near the
// tip (bottom) is loud, like the leverage of a real key. Clamped to a musical range.
const MIN_TAP_VELOCITY = 45;
const MAX_TAP_VELOCITY = 120;

// The letter to print on a key, or null for none. "all" labels every key; "c" prints
// only on the C keys, the landmark that orients a beginner (the white key just left of
// each two-black-key group); "off" prints nothing.
function keyLabel(note: number, labels: NoteLabels): string | null {
    if (labels === "all") {
        return pitchClass(note);
    }
    if (labels === "c" && ((note % 12) + 12) % 12 === 0) {
        return "C";
    }
    return null;
}

// The typographic sharp pitchClass prints, and the word a screen reader should say
// instead — a bare "#" (or the "♯" glyph) is read as "number"/"pound", not "sharp".
const SHARP_GLYPH = "♯";
const SPOKEN_SHARP = " sharp";

// A key's spoken name: "C sharp 4", not "C#4" — the sharp is spelled and the octave is
// spaced off the letter so a screen reader announces the pitch a player expects.
function spokenNote(note: number): string {
    const octave = Math.floor(note / 12) - 1;
    return `${pitchClass(note).replace(SHARP_GLYPH, SPOKEN_SHARP)} ${octave}`;
}

const NONE: ReadonlySet<number> = new Set();
const NO_HOLDS: ReadonlyMap<number, number> = new Map();

// The shrinking fill that shows how long a just-played note is meant to be held:
// a translucent indigo bar rising the key's height, draining from full at the
// strike to empty at the note's written release. Pinned behind the label so the
// letter stays legible, and pointer-transparent so it never steals a press.
function HoldFill({ fraction }: { fraction: number }) {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-indigo-400/45 dark:bg-indigo-400/40"
            style={{ height: `${Math.min(1, Math.max(0, fraction)) * 100}%` }}
        />
    );
}

// The single on-screen piano, shared by the landing hero and every practice mode,
// so the instrument is literally the same component everywhere. Fully controlled:
// the parent says which keys are lit (held or pressed → green), which note to play
// next (expected → indigo) and the last wrong note (flashes red), and is told when
// a key goes down or up. A press held while the finger or mouse slides across the
// keybed glides note to note, each key pressed as it is entered and released as it is
// left. The hero feeds it a synth; the trainer feeds it the live MIDI/touch input.
export function Keyboard({
    from,
    to,
    lit = NONE,
    expected = [],
    wrong = null,
    rise = false,
    labels = "off",
    well = "mx-auto w-full max-w-xl",
    sustained = false,
    holds = NO_HOLDS,
    theme = DEFAULT_THEME,
    badge,
    onPress,
    onRelease,
}: {
    from: number;
    to: number;
    lit?: ReadonlySet<number>;
    expected?: number[];
    // How much of each just-played note's written length remains (1 at the strike,
    // 0 at its release), keyed by note — drives the shrinking hold-duration fill.
    holds?: ReadonlyMap<number, number>;
    // Print note names on the keys for a player still learning where the notes are.
    labels?: NoteLabels;
    // The last wrong note plus a bump counter, so a repeated miss re-flashes.
    wrong?: { note: number; seq: number } | null;
    // The landing hero's one-time key-rise on load; off everywhere else.
    rise?: boolean;
    // The keybed's width and centring; defaults to a centred, capped instrument.
    well?: string;
    // Whether the sustain pedal is held, shown as a glow along the keybed's foot.
    sustained?: boolean;
    // The cosmetic skin for the resting keys (unpressed white/black colours). The lit,
    // expected and wrong feedback colours ignore it — they carry meaning. Defaults to the
    // classic palette, so an unthemed keyboard renders exactly as before.
    theme?: { white: string; black: string };
    // An overlay pinned to the keybed's top-right corner — the MIDI-status badge. A
    // slot rather than a built-in so the bare Keyboard stays free of the MIDI context
    // (and rendarable in isolation); the wrappers that have the context pass it in.
    badge?: ReactNode;
    // A press carries an optional velocity (from tap position); omitted lets the funnel
    // fall back to its default loudness for keyboard/AT activations.
    onPress?: (note: number, velocity?: number) => void;
    onRelease?: (note: number) => void;
}) {
    const [flash, setFlash] = useState<{ note: number; seq: number } | null>(null);
    useEffect(() => {
        if (wrong == null) {
            return;
        }
        // Carry the seq into flash state so a repeated identical miss (same note, new seq)
        // is a distinct value — it re-renders, re-flashes, and re-announces, where storing
        // the bare note would be a no-op update the live region never re-speaks.
        setFlash({ note: wrong.note, seq: wrong.seq });
        // A cosmetic fade — the ui-is-pure rule keeps this primitive free of the
        // services context, so it owns its own transition timer (allow-listed in
        // dev/check-globals.mjs) rather than the injected Scheduler.
        const id = window.setTimeout(() => setFlash(null), 450);
        return () => window.clearTimeout(id);
    }, [wrong]);

    const notes: number[] = [];
    for (let note = from; note <= to; note++) {
        notes.push(note);
    }
    const whites = notes.filter(isWhite);
    const blacks = notes.filter((note) => !isWhite(note));
    // Guard against a range with no white keys (a degenerate single-black span):
    // dividing by zero would make every black key's left/width Infinity.
    const whiteWidth = whites.length ? 100 / whites.length : 0;
    // Cap the keyboard so keys can't stretch past a tall proportion, then centre it. The
    // black keys are positioned as a percentage of this same container, so capping the
    // container (rather than the white keys alone) keeps white and black keys aligned.
    const maxWidth = whites.length ? whites.length * MAX_WHITE_KEY_PX : undefined;

    const keysRef = useRef<HTMLDivElement>(null);
    // The one key in the tab order (roving tabindex): Tab reaches the keybed once, then
    // arrow keys walk the notes, instead of every key being its own tab stop.
    const [roved, setRoved] = useState(from);
    useEffect(() => {
        // Keep the rovable key inside the current range as pieces change.
        setRoved((current) => Math.min(Math.max(current, from), to));
    }, [from, to]);

    // A note sounds while at least one source holds it; the source is a pointerId, an
    // Enter/Space key, or a screen-reader click. Reference-counting per note is what lets
    // two fingers share a key without one lifting silencing the other, and what keeps a
    // real press alive when an assistive-tech auto-release fires for its own source.
    const noteSources = useRef(new Map<number, Set<string>>());
    // The note each active pointer currently sounds, and the set of pointers still down —
    // tracked apart from the note so a glide that drifts off the keys (a gap, the badge,
    // past the edge) releases the note yet stays live, and re-entering a key re-presses.
    const pointerNote = useRef(new Map<number, number>());
    const activePointers = useRef(new Set<number>());
    // When a pointer last went down, and when a key was last used, so the compatibility
    // `click` that trails a real press or an Enter/Space activation can be told apart
    // from a screen reader's synthesized activation.
    const lastPointerDown = useRef(Number.NEGATIVE_INFINITY);
    const lastKeyActivity = useRef(Number.NEGATIVE_INFINITY);
    const clickCounter = useRef(0);
    // Pending auto-release timers for click-activated notes, cleared on unmount.
    const clickTimers = useRef<Set<number>>(new Set());

    // Callbacks read through refs so the unmount cleanup (an empty-deps effect) releases
    // held notes with the latest handlers instead of a stale first-render closure.
    const onPressRef = useRef(onPress);
    onPressRef.current = onPress;
    const onReleaseRef = useRef(onRelease);
    onReleaseRef.current = onRelease;

    const sound = useCallback((source: string, note: number, velocity?: number) => {
        let set = noteSources.current.get(note);
        if (!set) {
            set = new Set();
            noteSources.current.set(note, set);
        }
        const wasSilent = set.size === 0;
        set.add(source);
        if (wasSilent) {
            // Pass velocity only when a tap position gave one, so keyboard/AT presses
            // stay a bare note the funnel loudens with its default.
            if (velocity === undefined) {
                onPressRef.current?.(note);
            } else {
                onPressRef.current?.(note, velocity);
            }
        }
    }, []);
    const silence = useCallback((source: string, note: number) => {
        const set = noteSources.current.get(note);
        if (!set?.has(source)) {
            return;
        }
        set.delete(source);
        if (set.size === 0) {
            noteSources.current.delete(note);
            onReleaseRef.current?.(note);
        }
    }, []);

    useEffect(() => {
        const timers = clickTimers.current;
        const sources = noteSources.current;
        return () => {
            for (const id of timers) {
                window.clearTimeout(id);
            }
            timers.clear();
            // A key still held at unmount (route/mode switch mid-press) never gets its
            // release event, so let it go here or its voice rings on and its lit state sticks.
            for (const note of sources.keys()) {
                onReleaseRef.current?.(note);
            }
            sources.clear();
        };
    }, []);

    // The key element under a screen point, or null for a gap or off the keybed. Black
    // keys overlay the whites, so a hit-test naturally prefers a black key where they meet.
    // Confined to this keybed's own keys: a glide dragged onto another Keyboard instance
    // on the page must not drive this one with the other's notes.
    const keyElementAt = (x: number, y: number): HTMLElement | null => {
        const key = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-note]") ?? null;
        return key && keysRef.current?.contains(key) ? key : null;
    };

    // A tap's velocity from where the key was struck within its height.
    const velocityAt = (clientY: number, key: HTMLElement): number | undefined => {
        const rect = key.getBoundingClientRect();
        if (rect.height <= 0) {
            return undefined;
        }
        const frac = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
        return Math.round(MIN_TAP_VELOCITY + frac * (MAX_TAP_VELOCITY - MIN_TAP_VELOCITY));
    };

    const pointerSource = (pointerId: number) => `p${pointerId}`;
    // Move a pointer onto a note: release the one it was sounding, sound the new one.
    // Same note (a hit-test that didn't cross a key boundary) is a no-op, so a plain
    // tap sounds exactly once and a glide sounds each key it crosses exactly once. A null
    // note releases the current one but leaves the pointer active for re-entry.
    const movePointer = (pointerId: number, note: number | null, velocity?: number) => {
        const prev = pointerNote.current.get(pointerId);
        if (prev === note) {
            return;
        }
        if (prev !== undefined) {
            silence(pointerSource(pointerId), prev);
        }
        if (note === null) {
            pointerNote.current.delete(pointerId);
            return;
        }
        pointerNote.current.set(pointerId, note);
        sound(pointerSource(pointerId), note, velocity);
    };

    const down = (event: React.PointerEvent) => {
        // The press starts on the key it lands on; the event target carries the note
        // directly (a hit-test needs layout that jsdom lacks).
        const key = (event.target as Element).closest<HTMLElement>("[data-note]");
        if (!key) {
            return;
        }
        event.preventDefault();
        lastPointerDown.current = event.timeStamp;
        activePointers.current.add(event.pointerId);
        // Capture the pointer to the whole keybed so every move keeps arriving here even
        // as the finger slides across keys and past the edge; each move is hit-tested to
        // the key beneath it. This is what turns a drag into a glide — reliably on touch,
        // where per-key enter/leave events don't fire dependably mid-drag.
        try {
            event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
            // A pointer the browser no longer tracks can't be captured; the glide simply
            // falls back to whatever events still arrive.
        }
        if (event.pointerType === "touch") {
            navigator.vibrate?.(8);
        }
        movePointer(event.pointerId, Number(key.dataset.note), velocityAt(event.clientY, key));
    };
    const move = (event: React.PointerEvent) => {
        // Gate on the pointer still being down, NOT on it currently sounding a note, so a
        // glide that dipped off the keys re-engages when it returns.
        if (!activePointers.current.has(event.pointerId)) {
            return;
        }
        const key = keyElementAt(event.clientX, event.clientY);
        movePointer(
            event.pointerId,
            key ? Number(key.dataset.note) : null,
            key ? velocityAt(event.clientY, key) : undefined,
        );
    };
    const endPointer = useCallback(
        (pointerId: number) => {
            const prev = pointerNote.current.get(pointerId);
            if (prev !== undefined) {
                silence(`p${pointerId}`, prev);
                pointerNote.current.delete(pointerId);
            }
            activePointers.current.delete(pointerId);
        },
        [silence],
    );
    const up = (event: React.PointerEvent) => endPointer(event.pointerId);

    // A window-level backstop for the pointer's end. Pointer capture keeps a glide's moves
    // arriving at the keybed, but setPointerCapture can be refused (a pointer the browser
    // no longer tracks — the catch above), and then a release off the keys sends its
    // pointerup nowhere near this element. Catching it on the window releases the note
    // rather than leaving it stuck sounding and lit until unmount. endPointer no-ops for a
    // pointer this keyboard isn't tracking, so other pointers on the page are ignored.
    useEffect(() => {
        const onWindowUp = (event: PointerEvent) => endPointer(event.pointerId);
        window.addEventListener("pointerup", onWindowUp);
        window.addEventListener("pointercancel", onWindowUp);
        return () => {
            window.removeEventListener("pointerup", onWindowUp);
            window.removeEventListener("pointercancel", onWindowUp);
        };
    }, [endPointer]);

    // Move the roving focus to a note in range and focus its key.
    const focusNote = (note: number) => {
        const clamped = Math.min(Math.max(note, from), to);
        setRoved(clamped);
        keysRef.current?.querySelector<HTMLButtonElement>(`[data-note="${clamped}"]`)?.focus();
    };

    const keyDown = (note: number) => (event: React.KeyboardEvent) => {
        // Arrow keys walk the keybed (roving tabindex); Enter/Space sound the key.
        // Navigation keys stopPropagation as well as preventDefault: the global computer-key
        // listener on window also reads ArrowUp/ArrowDown as octave shifts, so without halting
        // the bubble, walking the keybed vertically would silently transpose the play octave.
        switch (event.key) {
            case "ArrowRight":
                event.preventDefault();
                event.stopPropagation();
                focusNote(note + 1);
                return;
            case "ArrowLeft":
                event.preventDefault();
                event.stopPropagation();
                focusNote(note - 1);
                return;
            case "ArrowUp":
                event.preventDefault();
                event.stopPropagation();
                focusNote(note + 12);
                return;
            case "ArrowDown":
                event.preventDefault();
                event.stopPropagation();
                focusNote(note - 12);
                return;
            case "Home":
                event.preventDefault();
                event.stopPropagation();
                focusNote(from);
                return;
            case "End":
                event.preventDefault();
                event.stopPropagation();
                focusNote(to);
                return;
            case "Enter":
            case " ":
                event.preventDefault();
                lastKeyActivity.current = event.timeStamp;
                // A held key auto-repeats keydown; sound it once, not on every repeat.
                if (event.repeat) {
                    return;
                }
                sound(`k${note}`, note);
                return;
        }
    };
    const keyUp = (note: number) => (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
            lastKeyActivity.current = event.timeStamp;
            silence(`k${note}`, note);
        }
    };
    // Focus leaving a key held via Enter/Space (Tab away mid-press) never sends a keyup,
    // so release on blur too, or the note sticks.
    const blur = (note: number) => () => silence(`k${note}`, note);

    // A screen reader (VoiceOver, TalkBack) activates a control with a synthesized
    // click — no pointer sequence and no key press — which the pointer and keyboard
    // handlers never see. Those clicks carry detail 0; a real mouse/touch click carries
    // a positive detail and is trailed just after a pointerdown. Sound a brief note for
    // the synthesized kind so an assistive-tech user can play a key too. A press has no
    // AT gesture, so it self-releases shortly after — on its own source, so a real press
    // of the same note in the meantime keeps sounding.
    const activate = (note: number) => (event: React.MouseEvent) => {
        const trailingRealClick =
            event.detail !== 0 ||
            event.timeStamp - lastPointerDown.current < 700 ||
            event.timeStamp - lastKeyActivity.current < 700;
        if (trailingRealClick) {
            return;
        }
        const source = `c${clickCounter.current++}`;
        sound(source, note);
        const id = window.setTimeout(() => {
            clickTimers.current.delete(id);
            silence(source, note);
        }, 180);
        clickTimers.current.add(id);
    };

    const whiteState = (note: number) =>
        flash?.note === note
            ? "bg-red-200 dark:bg-red-900"
            : lit.has(note)
              ? "translate-y-0.5 bg-green-200 shadow-[0_0_14px_-3px] shadow-green-400 dark:bg-green-900"
              : expected.includes(note)
                ? "bg-indigo-50 dark:bg-indigo-950"
                : theme.white;
    const blackState = (note: number) =>
        flash?.note === note
            ? "bg-red-500"
            : lit.has(note)
              ? "translate-y-0.5 bg-green-500 shadow-[0_0_14px_-3px] shadow-green-500"
              : expected.includes(note)
                ? "bg-indigo-400"
                : theme.black;

    // The wrong note, spoken into a live region so a screen-reader player hears the miss
    // that the red flash only shows sighted players.
    const flashNote = flash?.note ?? null;

    return (
        <div className={`${KEYBED_WELL} ${well}`}>
            {/* biome-ignore lint/a11y/useSemanticElements: a keybed is a group of piano keys, not a fieldset */}
            <div
                ref={keysRef}
                role="group"
                aria-label={m.keyboard_label()}
                className="relative mx-auto h-36 w-full touch-none select-none"
                style={{ maxWidth }}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                onLostPointerCapture={up}
            >
                {badge}
                <div className="flex h-full w-full gap-px">
                    {whites.map((note, index) => (
                        <button
                            key={note}
                            type="button"
                            aria-label={spokenNote(note)}
                            aria-pressed={lit.has(note)}
                            tabIndex={note === roved ? 0 : -1}
                            data-note={note}
                            onClick={activate(note)}
                            onKeyDown={keyDown(note)}
                            onKeyUp={keyUp(note)}
                            onBlur={blur(note)}
                            style={rise ? { animationDelay: `${index * 45}ms` } : undefined}
                            className={`${WHITE_KEY} flex-1 ${rise ? "animate-key-rise motion-reduce:animate-none" : ""} ${whiteState(note)}`}
                        >
                            {holds.has(note) && <HoldFill fraction={holds.get(note)!} />}
                            {keyLabel(note, labels) && (
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[10px] font-medium text-gray-400 dark:text-gray-600"
                                >
                                    {keyLabel(note, labels)}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                {blacks.map((note, index) => {
                    const whitesBefore = whites.filter((white) => white < note).length;
                    // A black key sits over the gap after its white neighbour. When the
                    // range begins or ends on a black key it has no neighbour on one
                    // side, so clamp it within [0, 100%] rather than hang it off the edge.
                    const width = whiteWidth * 0.6;
                    const left = Math.min(
                        Math.max(0, whitesBefore * whiteWidth - whiteWidth * 0.3),
                        100 - width,
                    );
                    return (
                        <button
                            key={note}
                            type="button"
                            aria-label={spokenNote(note)}
                            aria-pressed={lit.has(note)}
                            tabIndex={note === roved ? 0 : -1}
                            data-note={note}
                            onClick={activate(note)}
                            onKeyDown={keyDown(note)}
                            onKeyUp={keyUp(note)}
                            onBlur={blur(note)}
                            style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                ...(rise ? { animationDelay: `${index * 45}ms` } : {}),
                            }}
                            className={`${BLACK_KEY} h-2/3 ${rise ? "animate-key-rise motion-reduce:animate-none" : ""} ${blackState(note)}`}
                        >
                            {holds.has(note) && <HoldFill fraction={holds.get(note)!} />}
                            {keyLabel(note, labels) && (
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-0 bottom-0.5 text-center text-[8px] font-medium leading-tight text-gray-300"
                                >
                                    {keyLabel(note, labels)}
                                </span>
                            )}
                        </button>
                    );
                })}
                {sustained && (
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-1 rounded-full bg-amber-400/80 shadow-[0_0_10px_0] shadow-amber-400"
                    />
                )}
            </div>
            <span key={flash?.seq} className="sr-only" role="status" aria-live="assertive">
                {flashNote !== null ? m.keyboard_wrong_note({ note: spokenNote(flashNote) }) : ""}
            </span>
        </div>
    );
}
