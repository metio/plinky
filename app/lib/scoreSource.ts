// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { stripAccompaniment } from "../../core/accompaniment";
import { stripBeams } from "../../core/beams";
import type { HandSpan } from "../../core/prefs";
import type { Reduction } from "../../core/reduction";
import { simplify } from "../../core/simplify";
import { transposeMusicXml } from "../../core/transpose";
import type { XmlCodec } from "../../core/xml";
import type { FingerMap } from "../stores/fingeringStore";
import { annotateFingerings } from "./fingerScore";

// What decides the notes the engraver is handed. Everything else the score is drawn
// with — bars per row, zoom, bar numbers, the treadmill, a focus range — is layout, and
// changes nothing here.
export type ScoreSourceInputs = {
    xml: string;
    // Semitone shift, applied before anything else reads the notes.
    transpose: number;
    // The player's reach, which the suggested fingering is personalised to.
    handSpan: HandSpan;
    // The player's own fingering to print instead of the suggestion, or undefined for it.
    saved: FingerMap | undefined;
    showAccompaniment: boolean;
    reduction: Reduction | undefined;
    showBeams: boolean;
};

// The MusicXML the engraver loads: the piece as the player is to read it.
//
// The order is the meaning. Transpose first, then annotate, so the printed fingering is
// computed for the key actually being played. Then drop the other parts, so the cursor,
// the matcher and every staff index downstream see the piano's grand staff exactly as a
// solo piece gives them. Thin the texture after the fingering, so the numbers were worked
// out for the notes as written and the reduction inherits them for the notes it keeps —
// fingering a thinned chord would print advice for a hand position nobody is in. Drop the
// beams last, so short notes render with flags instead of beat groups; notes and durations
// are untouched, so playback, timing and matching are unaffected.
//
// Five parse-and-serialise passes and a whole-piece fingering search, so it is worth
// computing once per change of these inputs and not once per relayout.
export function prepareScoreSource(codec: XmlCodec, inputs: ScoreSourceInputs): string {
    const transposed =
        inputs.transpose === 0
            ? inputs.xml
            : transposeMusicXml(codec, inputs.xml, inputs.transpose);
    const annotated = annotateFingerings(codec, transposed, inputs.handSpan, inputs.saved);
    const played = inputs.showAccompaniment ? annotated : stripAccompaniment(codec, annotated);
    const reduced = inputs.reduction ? simplify(codec, played, inputs.reduction) : played;
    return inputs.showBeams ? reduced : stripBeams(codec, reduced);
}
