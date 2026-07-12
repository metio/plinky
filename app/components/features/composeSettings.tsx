// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { fieldClasses } from "../ui/classes";

type ComposeSettingsProps = {
    title: string;
    onTitle: (title: string) => void;
    tempo: number;
    onTempo: (tempo: number) => void;
    beatsPerBar: number;
    onBeatsPerBar: (beats: number) => void;
    quantizeOn: boolean;
    onQuantize: (on: boolean) => void;
    metronomeOn: boolean;
    onMetronome: (on: boolean) => void;
};

const LABEL = "block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";

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
            <label className="space-y-1">
                <span className={LABEL}>{m.compose_tempo_label()}</span>
                <input
                    type="number"
                    min={40}
                    max={240}
                    value={tempo}
                    onChange={(event) =>
                        onTempo(Math.min(240, Math.max(40, Number(event.target.value) || 120)))
                    }
                    className={`${fieldClasses} w-20`}
                />
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
            <label className="flex items-center gap-2 pb-2">
                <input
                    type="checkbox"
                    checked={quantizeOn}
                    onChange={(event) => onQuantize(event.target.checked)}
                    className="h-4 w-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                    {m.compose_quantize_label()}
                </span>
            </label>
            <label className="flex items-center gap-2 pb-2">
                <input
                    type="checkbox"
                    checked={metronomeOn}
                    onChange={(event) => onMetronome(event.target.checked)}
                    className="h-4 w-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                    {m.compose_metronome_label()}
                </span>
            </label>
        </section>
    );
}
