// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { keysIn, sizeFromName } from "../../../core/instrumentRange";
import { isPreciseInput, noteName } from "../../../core/midi";
import { useMidiConnection, useMidiInput } from "../../contexts/midi";
import { useInstrumentRange } from "../../hooks/useInstrumentRange";
import { usePrefs } from "../../hooks/usePrefs";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { SettingsSection } from "../ui/settingsSection";

// How many keys the instrument in the room has, measured by playing its two ends.
//
// MIDI never says: a device reports a name and a manufacturer and nothing about its
// keybed. A name often gives it away — a "Keystation 61" is a 61-key keyboard — and that
// guess is used where it applies, but it is a guess, so the two keys the player presses
// here beat it. What it buys is that pieces reaching past those keys are moved into them
// by whole octaves instead of asking for a key that does not exist.
//
// Only a real instrument's notes count. Tapping the on-screen keyboard would measure the
// screen, and the computer keyboard has no ends to press.
export function InstrumentRangeSetting() {
    const { prefs, update } = usePrefs();
    const { devices } = useMidiConnection();
    const range = useInstrumentRange();
    const [measuring, setMeasuring] = useState(false);
    const [pressed, setPressed] = useState<number[]>([]);
    const [tooClose, setTooClose] = useState(false);

    useMidiInput({
        onNoteOn: (event) => {
            if (!measuring || !isPreciseInput(event.device)) {
                return;
            }
            setTooClose(false);
            // The first key is one end and the second the other; a third starts over, so a
            // stray note is one more press to undo rather than a cancel.
            setPressed((keys) => (keys.length >= 2 ? [event.note] : [...keys, event.note]));
        },
    });

    const low = pressed.length === 2 ? Math.min(...pressed) : undefined;
    const high = pressed.length === 2 ? Math.max(...pressed) : undefined;

    const stop = () => {
        setMeasuring(false);
        setPressed([]);
        setTooClose(false);
    };
    const save = () => {
        if (low === undefined || high === undefined) {
            return;
        }
        // Under an octave is not a keyboard; it is two keys pressed near each other. Saving
        // it would make every piece unplayable, so it asks again instead.
        if (high - low < 12) {
            setPressed([]);
            setTooClose(true);
            return;
        }
        update({ instrumentRange: { from: low, to: high } });
        stop();
    };

    const named = devices.some((device) => sizeFromName(device.name) !== null);
    const readout =
        pressed.length === 0
            ? m.instrument_range_awaiting_lowest()
            : low === undefined
              ? `${noteName(pressed[0]!)} · ${m.instrument_range_awaiting_highest()}`
              : `${noteName(low)} → ${noteName(high!)}`;

    return (
        <SettingsSection
            title={m.settings_instrument_range()}
            hint={m.settings_instrument_range_hint()}
            level={3}
        >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
                <span className="text-sm">
                    <span className="font-medium">
                        {keysIn(range) >= 88
                            ? m.instrument_range_all_keys()
                            : m.instrument_range_keys({ count: keysIn(range) })}
                    </span>
                    {prefs.instrumentRange === null && named && (
                        <span className="text-muted"> · {m.instrument_range_from_name()}</span>
                    )}
                </span>
                <span className="flex shrink-0 flex-wrap gap-2">
                    <Button
                        variant="secondary"
                        disabled={devices.length === 0 || measuring}
                        onClick={() => {
                            setPressed([]);
                            setTooClose(false);
                            setMeasuring(true);
                        }}
                    >
                        {m.instrument_range_measure()}
                    </Button>
                    {prefs.instrumentRange !== null && (
                        <Button
                            variant="secondary"
                            onClick={() => update({ instrumentRange: null })}
                        >
                            {m.instrument_range_reset()}
                        </Button>
                    )}
                </span>
            </div>

            {devices.length === 0 && (
                <p className="text-xs text-muted">{m.instrument_range_no_device()}</p>
            )}

            {measuring && (
                <div className="space-y-2 rounded-md border border-accent-line bg-accent-surface p-3">
                    <p className="font-mono text-sm text-ink-soft">{readout}</p>
                    {tooClose && (
                        <p className="text-sm text-danger">{m.instrument_range_too_close()}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button variant="primary" onClick={save} disabled={low === undefined}>
                            {m.action_save()}
                        </Button>
                        <Button variant="secondary" onClick={stop}>
                            {m.import_cancel()}
                        </Button>
                    </div>
                </div>
            )}
        </SettingsSection>
    );
}
