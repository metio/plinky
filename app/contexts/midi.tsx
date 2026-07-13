// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    KEYBOARD_DEVICE,
    KEYBOARD_VELOCITY,
    MIC_DEVICE,
    ON_SCREEN_DEVICE,
    keyToNote,
    MAX_EVENTS,
    MAX_OCTAVE_OFFSET,
    MIN_OCTAVE_OFFSET,
    noteName,
    parseMidiMessage,
    type MidiDevice,
    type MidiNoteEvent,
    type MidiStatus,
    type MidiSupport,
} from "../../core/midi";
import { DEFAULT_KEY_MAP, type KeyMap } from "../../core/keyMap";
import type { CalibrationSample } from "../../core/micCalibration";
import { usePrefsStore } from "./services";
import type { MidiConnection } from "../ports/midiAccess";
import { useServices } from "./services";
import { resetDevice } from "../lib/resetDevice";

export type NoteListener = {
    onNoteOn?: (event: MidiNoteEvent) => void;
    onNoteOff?: (event: MidiNoteEvent) => void;
    // The sustain pedal changed: down holds released notes ringing, up drops them.
    // Only a real MIDI device sends this — the keyboard fallbacks have no pedal.
    onPedal?: (down: boolean, timestamp: number) => void;
};

declare global {
    interface Window {
        // Test/dev bridge for injecting notes as if from a MIDI device; attached
        // by MidiProvider outside production. See its effect below.
        __plinky?: {
            play: (note: number, velocity?: number) => void;
            release: (note: number) => void;
            // Raw MIDI bytes through the same parse-and-emit pipeline a real
            // device feeds, so a browser test exercises the full path.
            midiBytes: (data: number[], timestamp?: number) => void;
            // A snapshot of the connection state, for asserting from a page test.
            midiState: () => {
                support: MidiSupport;
                status: MidiStatus;
                error: string | null;
                devices: MidiDevice[];
                heldNotes: number[];
                octaveOffset: number;
            };
            // Wipe all local Plinky state and reload — a quick fresh start in dev.
            reset: () => void;
        };
    }
}

// The microphone's connection lifecycle, mirroring MidiStatus so the settings
// panel can speak the same language for both input seams.
export type MicStatus = "unsupported" | "idle" | "requesting" | "listening" | "denied" | "error";

type MidiContextValue = {
    support: MidiSupport;
    status: MidiStatus;
    error: string | null;
    devices: MidiDevice[];
    events: MidiNoteEvent[];
    heldNotes: number[];
    octaveOffset: number;
    requestAccess: () => void;
    clearEvents: () => void;
    subscribe: (listener: NoteListener) => () => void;
    // Play a note from the on-screen keyboard through the same funnel as MIDI.
    pressKey: (note: number) => void;
    releaseKey: (note: number) => void;
    // The microphone as an input device: an acoustic piano heard through pitch
    // detection lands in the same funnel as a MIDI keyboard.
    micStatus: MicStatus;
    startMic: () => void;
    stopMic: () => void;
    // Listen raw for the calibration wizard: per-frame loudness and pitch, no
    // tuning applied and nothing fed to the note funnel.
    startCalibration: (onSample: (sample: CalibrationSample) => void) => void;
};

const MidiContext = createContext<MidiContextValue | null>(null);

// A single connection shared across the whole app: connecting once persists
// across route changes, and the computer-keyboard fallback is always live.
export function MidiProvider({ children }: { children: ReactNode }) {
    // Injected capabilities: the MIDI seam itself, and the store the dev reset
    // bridge wipes — the provider renders inside ServicesProvider, so overrides
    // (a fake MIDI in tests) reach it too.
    const { midi, store, pitch, audio } = useServices();
    const prefsStore = usePrefsStore();
    const [support, setSupport] = useState<MidiSupport>("unknown");
    const [status, setStatus] = useState<MidiStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [devices, setDevices] = useState<MidiDevice[]>([]);
    const [events, setEvents] = useState<MidiNoteEvent[]>([]);
    const [heldNotes, setHeldNotes] = useState<number[]>([]);
    const [octaveOffset, setOctaveOffset] = useState(0);

    const connectionRef = useRef<MidiConnection | null>(null);
    const nextIdRef = useRef(0);
    const subscribersRef = useRef<Set<NoteListener>>(new Set());
    // The latest held notes, read by the window-blur handler to release them all.
    const heldNotesRef = useRef(heldNotes);
    heldNotesRef.current = heldNotes;

    const subscribe = useCallback((listener: NoteListener) => {
        subscribersRef.current.add(listener);
        return () => {
            subscribersRef.current.delete(listener);
        };
    }, []);

    useEffect(() => {
        setSupport(midi.supported() ? "supported" : "unsupported");
    }, [midi]);

    // The single funnel for every note, whether from a MIDI device or the
    // keyboard fallback, so both update shared state and reach all subscribers.
    const emitNote = useCallback(
        (
            kind: MidiNoteEvent["kind"],
            note: number,
            velocity: number,
            channel: number,
            device: string,
            timestamp: number,
        ) => {
            const noteEvent: MidiNoteEvent = {
                id: nextIdRef.current++,
                kind,
                note,
                noteName: noteName(note),
                velocity,
                channel,
                device,
                timestamp,
            };

            setEvents((prev) => [noteEvent, ...prev].slice(0, MAX_EVENTS));
            setHeldNotes((prev) => {
                if (kind === "noteon") {
                    return prev.includes(note) ? prev : [...prev, note].sort((a, b) => a - b);
                }
                return prev.filter((held) => held !== note);
            });

            for (const listener of subscribersRef.current) {
                if (kind === "noteon") {
                    listener.onNoteOn?.(noteEvent);
                } else {
                    listener.onNoteOff?.(noteEvent);
                }
            }
        },
        [],
    );

    // The pedal funnel, alongside emitNote: the sustain pedal carries no note, so it
    // reaches subscribers on its own channel rather than through the note pipeline.
    const emitPedal = useCallback((down: boolean, timestamp: number) => {
        for (const listener of subscribersRef.current) {
            listener.onPedal?.(down, timestamp);
        }
    }, []);

    const makeHandler = useCallback(
        (deviceName: string) => (data: Uint8Array, timestamp: number) => {
            const parsed = parseMidiMessage(data);
            if (!parsed) {
                return;
            }
            if (parsed.kind === "pedal") {
                emitPedal(parsed.down, timestamp);
                return;
            }
            emitNote(
                parsed.kind,
                parsed.note,
                parsed.velocity,
                parsed.channel,
                deviceName,
                timestamp,
            );
        },
        [emitNote, emitPedal],
    );

    // The bridge reads state through a ref so it needs no re-attachment per render.
    const bridgeStateRef = useRef({ support, status, error, devices, heldNotes, octaveOffset });
    bridgeStateRef.current = { support, status, error, devices, heldNotes, octaveOffset };

    // Lets browser tests — and the console — inject notes as if from a MIDI
    // device, to drive trainers end to end. Never attached in a production build.
    useEffect(() => {
        if (import.meta.env.PROD) {
            return;
        }
        window.__plinky = {
            play: (note, velocity = 80) =>
                emitNote("noteon", note, velocity, 1, "Test bridge", performance.now()),
            release: (note) => emitNote("noteoff", note, 0, 1, "Test bridge", performance.now()),
            midiBytes: (data, timestamp = performance.now()) =>
                makeHandler("Test bridge")(new Uint8Array(data), timestamp),
            midiState: () => ({
                ...bridgeStateRef.current,
                devices: [...bridgeStateRef.current.devices],
                heldNotes: [...bridgeStateRef.current.heldNotes],
            }),
            reset: () => {
                resetDevice(store);
                window.location.reload();
            },
        };
        return () => {
            window.__plinky = undefined;
        };
    }, [emitNote, store, makeHandler]);

    // Microphone pitch events join the funnel carrying a loudness-derived
    // velocity, falling back to the keyboard's fixed one for an event without.
    const [micStatus, setMicStatus] = useState<MicStatus>("idle");
    useEffect(() => {
        if (!pitch.supported()) {
            setMicStatus("unsupported");
        }
    }, [pitch]);
    const startMic = useCallback(() => {
        setMicStatus("requesting");
        // The player's own tuning, if they have run the wizard on this device, so
        // the live detector hears their room's floor, octave and dynamics.
        const calibration = prefsStore.load().micCalibration ?? undefined;
        // Notes the guard swallowed as our own speaker's echo, so their later
        // note-offs are swallowed too instead of releasing keys never pressed.
        const suppressed = new Set<number>();
        void pitch
            .start(
                (event) => {
                    if (event.kind === "on") {
                        // The echo guard: while Listen playback, the metronome or the
                        // completion flourish rings from the speaker, the detector will
                        // hear it. A pitch (or its octave neighbour — the detector's one
                        // characteristic slip) that WE recently synthesized is our own
                        // sound coming back, not the player — drop it. Anything else
                        // passes, so playing along over playback still works.
                        const echoed = [event.note, event.note - 12, event.note + 12].some(
                            (candidate) => audio.recentlyStruck?.(candidate, 300) === true,
                        );
                        if (echoed) {
                            suppressed.add(event.note);
                            return;
                        }
                        emitNote(
                            "noteon",
                            event.note,
                            event.velocity ?? KEYBOARD_VELOCITY,
                            1,
                            MIC_DEVICE,
                            performance.now(),
                        );
                    } else {
                        if (suppressed.delete(event.note)) {
                            return;
                        }
                        emitNote("noteoff", event.note, 0, 1, MIC_DEVICE, performance.now());
                    }
                },
                { calibration },
            )
            .then(setMicStatus);
    }, [pitch, emitNote, audio, prefsStore]);
    // The calibration wizard's private line to the microphone: the same central
    // connection (so it can't fight the live listener), started RAW — no tuning,
    // no note funnel — streaming per-frame telemetry for the wizard to measure.
    const startCalibration = useCallback(
        (onSample: (sample: CalibrationSample) => void) => {
            setMicStatus("requesting");
            void pitch.start(() => {}, { onSample }).then(setMicStatus);
        },
        [pitch],
    );
    const stopMic = useCallback(() => {
        pitch.stop();
        setMicStatus(pitch.supported() ? "idle" : "unsupported");
    }, [pitch]);
    // Leaving the app entirely releases the microphone; route changes keep it,
    // the same way the MIDI connection persists.
    useEffect(() => () => pitch.stop(), [pitch]);

    const pressKey = useCallback(
        (note: number) =>
            emitNote("noteon", note, KEYBOARD_VELOCITY, 1, ON_SCREEN_DEVICE, performance.now()),
        [emitNote],
    );
    const releaseKey = useCallback(
        (note: number) => emitNote("noteoff", note, 0, 1, ON_SCREEN_DEVICE, performance.now()),
        [emitNote],
    );

    // The inputs seen connected on the last refresh, so a disconnection can be spotted.
    const connectedInputsRef = useRef<Set<string>>(new Set());

    const refreshDevices = useCallback(() => {
        const connection = connectionRef.current;
        if (!connection) {
            return;
        }
        const list: MidiDevice[] = [];
        const nowConnected = new Set<string>();
        for (const input of connection.inputs()) {
            list.push({
                id: input.id,
                name: input.name,
                manufacturer: input.manufacturer,
                state: input.state,
            });
            input.onMessage(makeHandler(input.name));
            if (input.state === "connected") {
                nowConnected.add(input.id);
            }
        }
        // A device unplugged mid-hold never sends its note-offs, so a held note would stay
        // stuck on — in the debug panel, on the on-screen keyboard, and in any run's hold
        // that never resolves. When an input that was connected has gone (or flipped to
        // disconnected), release every held note. A held pitch isn't attributed to a device,
        // so this releases all of them on any disconnection — a stray note-off is far less
        // bad than a stuck note.
        const dropped = [...connectedInputsRef.current].some((id) => !nowConnected.has(id));
        connectedInputsRef.current = nowConnected;
        if (dropped) {
            for (const note of heldNotesRef.current) {
                emitNote("noteoff", note, 0, 1, "MIDI", performance.now());
            }
        }
        setDevices(list);
    }, [makeHandler, emitNote]);

    // Each request gets a sequence number; only the latest may wire itself in.
    // A stale resolve (an earlier click, or one landing after unmount) closes its
    // connection instead — otherwise two live connections would double every note.
    const requestSeqRef = useRef(0);
    const requestAccess = useCallback(() => {
        if (!midi.supported()) {
            setStatus("error");
            setError("Web MIDI API is not available in this browser.");
            return;
        }
        const seq = ++requestSeqRef.current;
        setStatus("requesting");
        setError(null);
        midi.request()
            .then((connection) => {
                if (seq !== requestSeqRef.current) {
                    connection.close();
                    return;
                }
                connectionRef.current?.close();
                connectionRef.current = connection;
                connection.onStateChange(() => refreshDevices());
                setStatus("ready");
                refreshDevices();
            })
            .catch((err: unknown) => {
                if (seq !== requestSeqRef.current) {
                    return;
                }
                setStatus("denied");
                setError(err instanceof Error ? err.message : String(err));
            });
    }, [midi, refreshDevices]);

    // Silently reconnect MIDI when the player has already granted it (through the
    // Connect button), so a connected keyboard just works across the app — the
    // landing hero included — without ever prompting on load. While permission is
    // still "prompt" or "denied", do nothing: requesting would pop the dialog.
    useEffect(() => {
        let cancelled = false;
        midi.permissionState().then((state) => {
            if (!cancelled && state === "granted") {
                requestAccess();
            }
        });
        return () => {
            cancelled = true;
        };
    }, [midi, requestAccess]);

    const clearEvents = useCallback(() => setEvents([]), []);

    // Computer-keyboard fallback. The active octave and the key→note map are kept in
    // refs so the listeners stay stable while still reading the latest values; the map
    // is refreshed when Settings saves a remap, so a new layout takes effect at once.
    const octaveRef = useRef(0);
    const keyMapRef = useRef<KeyMap>(DEFAULT_KEY_MAP);
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const loadKeyMap = () => {
            keyMapRef.current = prefsStore.load().keyMap;
        };
        loadKeyMap();
        const unsubscribePrefs = prefsStore.subscribe(loadKeyMap);
        const pressed = new Map<string, number>();

        const isTextEntry = (target: EventTarget | null): boolean => {
            const el = target as HTMLElement | null;
            return (
                !!el &&
                (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
            );
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.repeat ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                isTextEntry(event.target)
            ) {
                return;
            }
            const key = event.key.toLowerCase();

            if (key === "arrowup" || key === "arrowdown") {
                event.preventDefault();
                const next = Math.min(
                    MAX_OCTAVE_OFFSET,
                    Math.max(MIN_OCTAVE_OFFSET, octaveRef.current + (key === "arrowup" ? 1 : -1)),
                );
                octaveRef.current = next;
                setOctaveOffset(next);
                return;
            }

            const note = keyToNote(key, octaveRef.current, keyMapRef.current);
            if (note === null || pressed.has(key)) {
                return;
            }
            if (note < 0 || note > 127) {
                return;
            }
            event.preventDefault();
            pressed.set(key, note);
            emitNote("noteon", note, KEYBOARD_VELOCITY, 1, KEYBOARD_DEVICE, event.timeStamp);
        };

        const onKeyUp = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            const note = pressed.get(key);
            if (note === undefined) {
                return;
            }
            pressed.delete(key);
            emitNote("noteoff", note, 0, 1, KEYBOARD_DEVICE, event.timeStamp);
        };

        // A keyup (or an on-screen key's pointerup) is delivered only to the focused
        // window, so a note still held when focus leaves (Alt-Tab, clicking away)
        // would never release and stay stuck. Release every held note — from the
        // computer keyboard, the on-screen keyboard, or a device — when focus is lost.
        const releaseAll = () => {
            pressed.clear();
            for (const note of heldNotesRef.current) {
                emitNote("noteoff", note, 0, 1, KEYBOARD_DEVICE, performance.now());
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", releaseAll);
        return () => {
            unsubscribePrefs();
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", releaseAll);
        };
    }, [emitNote, prefsStore]);

    useEffect(() => {
        return () => {
            requestSeqRef.current++;
            connectionRef.current?.close();
        };
    }, []);

    const value: MidiContextValue = {
        support,
        status,
        error,
        devices,
        events,
        heldNotes,
        octaveOffset,
        requestAccess,
        clearEvents,
        subscribe,
        pressKey,
        releaseKey,
        micStatus,
        startMic,
        stopMic,
        startCalibration,
    };

    return <MidiContext.Provider value={value}>{children}</MidiContext.Provider>;
}

function useMidiContext(): MidiContextValue {
    const ctx = useContext(MidiContext);
    if (!ctx) {
        throw new Error("MIDI hooks must be used within a MidiProvider.");
    }
    return ctx;
}

// Connection state and actions for UI (support, devices, octave, requestAccess,
// and the event monitor used by the debug panel).
export function useMidiConnection(): MidiContextValue {
    return useMidiContext();
}

// Subscribe to note events for the lifetime of the calling component. Handlers
// are read through a ref so the subscription is set up once and always calls
// the latest callbacks.
export function useMidiInput(handlers: NoteListener): void {
    const { subscribe } = useMidiContext();
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        return subscribe({
            onNoteOn: (event) => handlersRef.current.onNoteOn?.(event),
            onNoteOff: (event) => handlersRef.current.onNoteOff?.(event),
            onPedal: (down, timestamp) => handlersRef.current.onPedal?.(down, timestamp),
        });
    }, [subscribe]);
}
