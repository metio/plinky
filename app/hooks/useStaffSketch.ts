// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { type Composition, toMusicXml } from "../../core/composition";

// The live staff sketch of a take: MusicXML re-engraved a beat after the last
// note lands rather than on every keystroke, so a fast passage doesn't thrash
// the OSMD renderer. Quantizing snaps to eighths for a clean read; the looser
// setting keeps more of the played rhythm. Null while the take is empty.
export function useStaffSketch(
    composition: Composition,
    title: string,
    quantizeOn: boolean,
): string | null {
    const [staffXml, setStaffXml] = useState<string | null>(null);

    useEffect(() => {
        if (composition.notes.length === 0) {
            setStaffXml(null);
            return;
        }
        const id = window.setTimeout(() => {
            setStaffXml(
                toMusicXml(composition, {
                    title,
                    subdivisionsPerBeat: quantizeOn ? 2 : 4,
                }),
            );
        }, 150);
        return () => window.clearTimeout(id);
    }, [composition, title, quantizeOn]);

    return staffXml;
}
