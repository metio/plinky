// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { TuneObject } from "abcjs";
import { useEffect, useRef, useState } from "react";
import { buildHands } from "../lib/hands";

const PITCH_CLASSES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const PREF_KEY = "plinky:note-names";

function noteClass(pitch: number): string {
    return PITCH_CLASSES[((pitch % 12) + 12) % 12];
}

function loadPref(): boolean {
    try {
        return localStorage.getItem(PREF_KEY) === "1";
    } catch {
        return false;
    }
}

// Draw the note name under each notehead. getBBox needs layout, so this is a
// no-op where it is unavailable (e.g. jsdom); labels are appended beside each
// note element so they inherit its group transform and line up.
function overlayNoteNames(tune: TuneObject): void {
    for (const hand of buildHands(tune, 100)) {
        for (const step of hand.steps) {
            const name = step.pitches.map(noteClass).join("/");
            for (const element of step.elements) {
                try {
                    const box = (element as unknown as SVGGraphicsElement).getBBox();
                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.setAttribute("x", String(box.x + box.width / 2));
                    text.setAttribute("y", String(box.y + box.height + 13));
                    text.setAttribute("text-anchor", "middle");
                    text.setAttribute("font-size", "9");
                    text.setAttribute("fill", "#4f46e5");
                    text.textContent = name;
                    element.parentNode?.appendChild(text);
                } catch {
                    // No layout engine — skip the overlay.
                }
            }
        }
    }
}

export function AbcRenderer({
    abcTune,
    onRender,
}: {
    abcTune: string;
    onRender?: (tune: TuneObject) => void;
}) {
    const abcElement = useRef<HTMLDivElement>(null);
    const [showNames, setShowNames] = useState(false);

    useEffect(() => {
        setShowNames(loadPref());
    }, []);

    useEffect(() => {
        const element = abcElement.current;
        if (!element) {
            return;
        }
        let cancelled = false;
        // abcjs is ~0.5 MB, so it is loaded on demand the first time a score
        // renders rather than in the initial bundle.
        import("abcjs").then(({ default: abcjs }) => {
            if (cancelled) {
                return;
            }
            const tunes = abcjs.renderAbc(element, abcTune, {
                add_classes: true,
                responsive: "resize",
            });
            if (tunes[0]) {
                onRender?.(tunes[0]);
                if (showNames) {
                    overlayNoteNames(tunes[0]);
                }
            }
        });
        return () => {
            cancelled = true;
        };
    }, [abcTune, onRender, showNames]);

    const toggle = () => {
        const next = !showNames;
        setShowNames(next);
        try {
            localStorage.setItem(PREF_KEY, next ? "1" : "0");
        } catch {
            // Preference persistence is best-effort.
        }
    };

    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input type="checkbox" checked={showNames} onChange={toggle} />
                Show note names
            </label>
            {/* The score keeps a white "paper" background in every theme so the black
                notation stays readable in dark mode. */}
            <div ref={abcElement} className="rounded bg-white p-2" />
        </div>
    );
}
