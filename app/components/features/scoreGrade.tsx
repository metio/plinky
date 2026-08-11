// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { gradeOf } from "../../../core/scoreDifficulty";
import { useXmlCodec } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";

// The computed 1–8 grade of a score, as a small chip — so a learner can pick
// material at their level. Tinted by difficulty band (low / mid / high) for a
// quick visual read; the number carries the meaning.
const BAND = [
    "bg-success-surface text-success",
    "bg-accent-surface text-accent-strong",
    "bg-spark-surface text-spark-strong",
];

// A grade chip from a known grade number — used in the library list, where song
// grades are precomputed in the manifest (no MusicXML to parse per row).
export function GradeChip({ grade, className }: { grade: number; className?: string }) {
    const band = BAND[grade <= 3 ? 0 : grade <= 5 ? 1 : 2];
    return (
        <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${band} ${className ?? ""}`}
        >
            {m.score_grade({ grade })}
        </span>
    );
}

// Computes a score's grade from its MusicXML, then chips it.
export function ScoreGrade({
    id,
    xml,
    className,
}: {
    id: string;
    xml: string;
    className?: string;
}) {
    const xmlCodec = useXmlCodec();
    return <GradeChip grade={gradeOf(xmlCodec, id, xml)} className={className} />;
}
