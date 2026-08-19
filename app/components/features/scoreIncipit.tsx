// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { readIncipit } from "../../../core/incipit";
import { usePrefsStore } from "../../contexts/services";
import { usePref } from "../../hooks/usePref";
import { useXmlCodec } from "../../contexts/services";
import { IncipitMark } from "../ui/incipit";

// A piece's opening bar beside its name, the way a thematic catalogue identifies a
// work: you know a piece by how it starts long before you know its catalogue number.
// Reading it costs one parse of a score already in hand, so it never asks the network
// for anything — a piece whose notation has not been fetched simply shows no mark.
//
// Coloured by note name when the setting is on, exactly as the baked marks in every list
// are — the mark beside a title is the same object whichever page it appears on, and a
// piece that reads in colour on the shelf reading in plain ink the moment you open it was
// the odder of the two. It follows the stored setting rather than the run's live reading
// aids: it belongs to the title block, not to the session, and a sight-read dialling the
// score's colours down should not repaint the catalogue.
export function ScoreIncipit({ xml, title }: { xml: string; title: string }) {
    const codec = useXmlCodec();
    const [colored] = usePref(usePrefsStore(), "colorNotes");
    const incipit = useMemo(() => readIncipit(codec, xml), [codec, xml]);
    if (!incipit) {
        return null;
    }
    return <IncipitMark incipit={incipit} label={title} colored={colored} className="text-faint" />;
}
