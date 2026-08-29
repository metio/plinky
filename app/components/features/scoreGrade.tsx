// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { gradeOf } from "../../../core/scoreDifficulty";
import { easiestWayIn, type Reach } from "../../../core/reach";
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

// The gentlest reading of a piece that is above where somebody is standing.
//
// A grade on its own can only say no. A piece two grades out of reach reads as "not yet",
// when what is usually true is that the tune is well within reach and the filling is not —
// which is exactly what a teacher does something about, by taking the inner notes out until
// the piece is playable today. Saying so in the same numbers everything else is graded in
// turns a closed door into a way in, and costs the piece's own grade nothing.
//
// Only the easiest way in is shown. The ladder behind it belongs on the piece's own page,
// where somebody has already decided to try; in a list it would be three numbers where one
// answers the question being asked.
export function WayIn({ reach, className }: { reach?: Reach; className?: string }) {
    const easiest = easiestWayIn(reach);
    if (easiest === null) {
        return null;
    }
    const grade = easiest.grade;
    const label =
        easiest.level === "thinned"
            ? m.way_in_thinned({ grade })
            : easiest.level === "outlined"
              ? m.way_in_outlined({ grade })
              : m.way_in_melody({ grade });
    return <span className={`text-xs text-muted ${className ?? ""}`}>{label}</span>;
}
