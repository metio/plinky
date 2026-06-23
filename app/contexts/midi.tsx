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
    KEY_SEMITONES,
    KEYBOARD_BASE_NOTE,
    KEYBOARD_DEVICE,
    KEYBOARD_VELOCITY,
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

export type NoteListener = {
    onNoteOn?: (event: MidiNoteEvent) => void;
    onNoteOff?: (event: MidiNoteEvent) => void;
};

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

    const clearEvents = useCallback(() => setEvents([]), []);

    // Computer-keyboard fallback. The active octave is kept in a ref so the
    // listeners stay stable while still reading the latest value.
    const octaveRef = useRef(0);
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
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

            const semitone = KEY_SEMITONES[key];
            if (semitone === undefined || pressed.has(key)) {
                return;
            }
            const note = KEYBOARD_BASE_NOTE + octaveRef.current * 12 + semitone;
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

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
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
