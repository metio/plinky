// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { hasFacts, readPieceFacts } from "../../../core/pieceFacts";
import { useXmlCodec } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";

// What the piece is, in numbers: how long it runs, how it is counted, how fast it goes.
//
// Read off the score the page already holds, so it costs no fetch and cannot disagree with
// the notation below it. A score the codec could not read says nothing at all — "0 bars"
// is worse than a page that does not mention its length.
export function PieceFactsLine({ xml }: { xml: string }) {
    const codec = useXmlCodec();
    const facts = readPieceFacts(codec, xml);
    if (!hasFacts(facts)) {
        return null;
    }
    return (
        <span className="text-xs text-muted tabular-nums">
            {m.play_facts({
                bars: facts.bars,
                beats: facts.beatsPerBar,
                tempo: facts.tempo,
            })}
        </span>
    );
}
