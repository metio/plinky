// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { readIncipit } from "../../../core/incipit";
import { useXmlCodec } from "../../contexts/services";
import { IncipitMark } from "../ui/incipit";

// A piece's opening bar beside its name, the way a thematic catalogue identifies a
// work: you know a piece by how it starts long before you know its catalogue number.
// Reading it costs one parse of a score already in hand, so it never asks the network
// for anything — a piece whose notation has not been fetched simply shows no mark.
//
// Never coloured by note name, whatever the reading aids say. The mark sits in the title
// block, outside the play session that owns those aids — so while a sight-read stripped
// the colours from the score, this went on colour-coding the opening bar, which is the one
// bar a cold read most wants left alone. A catalogue mark identifies a piece; it is not a
// place to teach note names.
export function ScoreIncipit({ xml, title }: { xml: string; title: string }) {
    const codec = useXmlCodec();
    const incipit = useMemo(() => readIncipit(codec, xml), [codec, xml]);
    if (!incipit) {
        return null;
    }
    return <IncipitMark incipit={incipit} label={title} className="text-faint" />;
}
