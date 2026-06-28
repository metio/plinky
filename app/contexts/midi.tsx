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
} from "../lib/midi";
import { DEFAULT_KEY_MAP, type KeyMap } from "../lib/keyMap";
import { loadPrefs, PREFS_CHANGED_EVENT } from "../lib/prefs";
import { resetDevice } from "../lib/resetDevice";

export type NoteListener = {
    onNoteOn?: (event: MidiNoteEvent) => void;
    onNoteOff?: (event: MidiNoteEvent) => void;
};

declare global {
    interface Window {
        // Test/dev bridge for injecting notes as if from a MIDI device; attached
        // by MidiProvider outside production. See its effect below.
        __plinky?: {
            play: (note: number, velocity?: number) => void;
            release: (note: number) => void;
            // Wipe all local Plinky state and reload — a quick fresh start in dev.
            reset: () => void;
        };
    }
}

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
};

const MidiContext = createContext<MidiContextValue | null>(null);

// A single connection shared across the whole app: connecting once persists
// across route changes, and the computer-keyboard fallback is always live.
export function MidiProvider({ children }: { children: ReactNode }) {
    const [support, setSupport] = useState<MidiSupport>("unknown");
    const [status, setStatus] = useState<MidiStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [devices, setDevices] = useState<MidiDevice[]>([]);
    const [events, setEvents] = useState<MidiNoteEvent[]>([]);
    const [heldNotes, setHeldNotes] = useState<number[]>([]);
    const [octaveOffset, setOctaveOffset] = useState(0);

    const accessRef = useRef<MIDIAccess | null>(null);
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
        setSupport(
            typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function"
                ? "supported"
                : "unsupported",
        );
    }, []);

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
            reset: () => {
                resetDevice();
                window.location.reload();
            },
        };
        return () => {
            window.__plinky = undefined;
        };
    }, [emitNote]);

    const pressKey = useCallback(
        (note: number) =>
            emitNote("noteon", note, KEYBOARD_VELOCITY, 1, ON_SCREEN_DEVICE, performance.now()),
        [emitNote],
    );
    const releaseKey = useCallback(
        (note: number) => emitNote("noteoff", note, 0, 1, ON_SCREEN_DEVICE, performance.now()),
        [emitNote],
    );

    const makeHandler = useCallback(
        (deviceName: string) => (event: MIDIMessageEvent) => {
            const parsed = parseMidiMessage(event.data);
            if (!parsed) {
                return;
            }
            emitNote(
                parsed.kind,
                parsed.note,
                parsed.velocity,
                parsed.channel,
                deviceName,
                event.timeStamp,
            );
        },
        [emitNote],
    );

    const refreshDevices = useCallback(() => {
        const access = accessRef.current;
        if (!access) {
            return;
        }
        const list: MidiDevice[] = [];
        for (const input of access.inputs.values()) {
            list.push({
                id: input.id,
                name: input.name ?? "Unknown device",
                manufacturer: input.manufacturer ?? "",
                state: input.state,
            });
            input.onmidimessage = makeHandler(input.name ?? "Unknown device");
        }
        setDevices(list);
    }, [makeHandler]);

    const requestAccess = useCallback(() => {
        if (typeof navigator === "undefined" || typeof navigator.requestMIDIAccess !== "function") {
            setStatus("error");
            setError("Web MIDI API is not available in this browser.");
            return;
        }
        setStatus("requesting");
        setError(null);
        navigator
            .requestMIDIAccess({ sysex: false })
            .then((access) => {
                accessRef.current = access;
                access.onstatechange = () => refreshDevices();
                setStatus("ready");
                refreshDevices();
            })
            .catch((err: unknown) => {
                setStatus("denied");
                setError(err instanceof Error ? err.message : String(err));
            });
    }, [refreshDevices]);

    // Silently reconnect MIDI when the player has already granted it (through the
    // Connect button), so a connected keyboard just works across the app — the
    // landing hero included — without ever prompting on load. While permission is
    // still "prompt" or "denied", do nothing: requesting would pop the dialog.
    useEffect(() => {
        let cancelled = false;
        navigator.permissions
            ?.query({ name: "midi" as PermissionName })
            .then((permission) => {
                if (!cancelled && permission.state === "granted") {
                    requestAccess();
                }
            })
            .catch(() => {
                // No Permissions API, or no "midi" descriptor (Safari, Firefox).
            });
        return () => {
            cancelled = true;
        };
    }, [requestAccess]);

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
            keyMapRef.current = loadPrefs().keyMap;
        };
        loadKeyMap();
        window.addEventListener(PREFS_CHANGED_EVENT, loadKeyMap);
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
            window.removeEventListener(PREFS_CHANGED_EVENT, loadKeyMap);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", releaseAll);
        };
    }, [emitNote]);

    useEffect(() => {
        return () => {
            const access = accessRef.current;
            if (!access) {
                return;
            }
            access.onstatechange = null;
            for (const input of access.inputs.values()) {
                input.onmidimessage = null;
            }
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
        });
    }, [subscribe]);
}
