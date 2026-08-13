// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { readIncipit } from "../../../core/incipit";
import { useXmlCodec } from "../../contexts/services";
import { usePrefs } from "../../hooks/usePrefs";
import { IncipitMark } from "../ui/incipit";

// A piece's opening bar beside its name, the way a thematic catalogue identifies a
// work: you know a piece by how it starts long before you know its catalogue number.
// Reading it costs one parse of a score already in hand, so it never asks the network
// for anything — a piece whose notation has not been fetched simply shows no mark.
//
// Coloured by note name only when the reader has that aid on, so the mark and the score
// under it are never coloured two different ways.
export function ScoreIncipit({ xml, title }: { xml: string; title: string }) {
    const codec = useXmlCodec();
    const { prefs } = usePrefs();
    const incipit = useMemo(() => readIncipit(codec, xml), [codec, xml]);
    if (!incipit) {
        return null;
    }
    return (
        <IncipitMark
            incipit={incipit}
            label={title}
            colored={prefs.colorNotes}
            className="text-faint"
        />
    );
}
