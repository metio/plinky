// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { parseExerciseId } from "../../../core/exerciseGen";
import { readHarmony } from "../../../core/harmony";
import { readTimeline } from "../../../core/musicxmlTimeline";
import { type PieceChords as Summary, summarizeChords } from "../../../core/pieceChords";
import { useXmlCodec } from "../../contexts/services";
import { exerciseName } from "../../lib/exerciseNames";
import { m } from "../../paraglide/messages.js";
import { linkClasses } from "../ui/classes";
import { KeysIcon } from "../ui/icons";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { SettingsSection } from "../ui/settingsSection";

// What the piece is built on, beside the marks it asks you to read: its chords, commonest
// first, the loop it returns to, and where to practise each apart from the piece — the
// chord set of its key on the shelf, and the ear drill that plays the progression.
//
// Numerals rather than letters, because the numeral is what carries between keys: a
// piece in G built on I V vi IV is the same piece to the hand as one in C. Nothing shows
// when the reading finds no chords at all, which a bare melody line is.
export function PieceChords({ xml }: { xml: string }) {
    const codec = useXmlCodec();
    const summary = useMemo<Summary | null>(() => {
        const doc = codec.parse(xml);
        return doc ? summarizeChords(readHarmony(readTimeline(doc))) : null;
    }, [codec, xml]);
    if (summary === null || summary.vocabulary.length === 0) {
        return null;
    }
    const set = summary.chordSet === null ? null : parseExerciseId(summary.chordSet);
    return (
        <SettingsSection
            title={m.piece_chords_title()}
            hint={m.piece_chords_hint()}
            icon={<KeysIcon className="h-5 w-5" />}
        >
            <ul className="flex flex-wrap gap-2" aria-label={m.piece_chords_title()}>
                {summary.vocabulary.map((chord) => (
                    <li
                        key={chord.numeral}
                        className="rounded-md bg-subtle px-2 py-1 font-serif text-sm text-body"
                    >
                        {chord.numeral}
                        <span className="ml-1 text-xs text-muted">×{chord.count}</span>
                    </li>
                ))}
            </ul>
            {summary.progression !== null && (
                <p className="text-sm text-body">
                    <span className="font-semibold">{m.piece_chords_progression()}:</span>{" "}
                    <span className="font-serif">{summary.progression.join(" – ")}</span>
                </p>
            )}
            <ul className="space-y-1 text-sm">
                {summary.chordSet !== null && set !== null && (
                    <li>
                        <Link to={`/play/${summary.chordSet}`} className={linkClasses}>
                            {exerciseName(set)}
                        </Link>
                    </li>
                )}
                {summary.earLevel !== null && (
                    <li>
                        <Link
                            to={`/ear?exercise=progressions&level=${summary.earLevel}`}
                            className={linkClasses}
                        >
                            {m.piece_chords_ear()}
                        </Link>
                    </li>
                )}
            </ul>
        </SettingsSection>
    );
}
