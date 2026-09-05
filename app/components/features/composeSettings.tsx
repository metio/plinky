// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { m } from "../../paraglide/messages.js";
import { fieldClasses } from "../ui/classes";
import { SwitchField } from "../ui/fields";

const MIN_TEMPO = 40;
const MAX_TEMPO = 240;
const DEFAULT_TEMPO = 120;

// The tempo field keeps what is being typed to itself until it is a tempo. A controlled
// number input that clamps on every keystroke cannot be typed into: selecting "120" and
// typing "9" on the way to "96" is clamped to 40 before the "6" arrives. So the text
// lives here while the field has focus, the take's tempo moves only when the text is a
// tempo in range, and leaving the field settles anything else to the nearest one.
function TempoField({
    id,
    tempo,
    onTempo,
}: {
    id: string;
    tempo: number;
    onTempo: (tempo: number) => void;
}) {
    const [typed, setTyped] = useState<string | null>(null);
    return (
        <input
            id={id}
            type="number"
            min={MIN_TEMPO}
            max={MAX_TEMPO}
            value={typed ?? String(tempo)}
            onChange={(event) => {
                const text = event.target.value;
                setTyped(text);
                const value = Number(text);
                if (text !== "" && value >= MIN_TEMPO && value <= MAX_TEMPO) {
                    onTempo(value);
                }
            }}
            onBlur={() => {
                if (typed !== null) {
                    const value = Number(typed);
                    onTempo(
                        typed === "" || !Number.isFinite(value)
                            ? DEFAULT_TEMPO
                            : Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, value)),
                    );
                }
                setTyped(null);
            }}
            className={`${fieldClasses} w-20`}
        />
    );
}

type ComposeSettingsProps = {
    title: string;
    onTitle: (title: string) => void;
    tempo: number;
    onTempo: (tempo: number) => void;
    beatsPerBar: number;
    onBeatsPerBar: (beats: number) => void;
    quantizeOn: boolean;
    // Step entry writes exact lengths, so there is nothing to tidy and the switch is held.
    quantizeLocked?: boolean;
    onQuantize: (on: boolean) => void;
    metronomeOn: boolean;
    onMetronome: (on: boolean) => void;
};

const LABEL = "block text-xs font-medium uppercase tracking-wide text-muted";

// The take's settings row: title, the tempo/meter grid the staff and exports are
// measured against, and the quantize/metronome toggles. Fully controlled — the
// route owns the values, this row just edits them.
export function ComposeSettings({
    title,
    onTitle,
    tempo,
    onTempo,
    beatsPerBar,
    onBeatsPerBar,
    quantizeOn,
    quantizeLocked = false,
    onQuantize,
    metronomeOn,
    onMetronome,
}: ComposeSettingsProps) {
    return (
        <section className="flex flex-wrap items-end gap-4">
            <label className="space-y-1">
                <span className={LABEL}>{m.compose_title_label()}</span>
                <input
                    type="text"
                    value={title}
                    onChange={(event) => onTitle(event.target.value)}
                    className={fieldClasses}
                />
            </label>
            <label htmlFor="compose-tempo" className="space-y-1">
                <span className={LABEL}>{m.compose_tempo_label()}</span>
                <TempoField id="compose-tempo" tempo={tempo} onTempo={onTempo} />
            </label>
            <label className="space-y-1">
                <span className={LABEL}>{m.compose_beats_label()}</span>
                <select
                    value={beatsPerBar}
                    onChange={(event) => onBeatsPerBar(Number(event.target.value))}
                    className={fieldClasses}
                >
                    <option value={2}>2/4</option>
                    <option value={3}>3/4</option>
                    <option value={4}>4/4</option>
                    <option value={6}>6/4</option>
                </select>
            </label>
            <SwitchField
                label={m.compose_quantize_label()}
                disabled={quantizeLocked}
                checked={quantizeOn && !quantizeLocked}
                onChange={onQuantize}
            />
            <SwitchField
                label={m.compose_metronome_label()}
                checked={metronomeOn}
                onChange={onMetronome}
            />
        </section>
    );
}
