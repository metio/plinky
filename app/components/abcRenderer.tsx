// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef } from "react";
import abcjs, { type TuneObject } from "abcjs";

export function AbcRenderer({
    abcTune,
    onRender,
}: {
    abcTune: string;
    onRender?: (tune: TuneObject) => void;
}) {
    const abcElement = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!abcElement.current) {
            return;
        }
        const tunes = abcjs.renderAbc(abcElement.current, abcTune, {
            add_classes: true,
            responsive: "resize",
        });
        if (tunes[0]) {
            onRender?.(tunes[0]);
        }
    }, [abcTune, onRender]);

    // The score keeps a white "paper" background in every theme so the black
    // notation stays readable in dark mode.
    return <div ref={abcElement} className="rounded bg-white p-2" />;
}
