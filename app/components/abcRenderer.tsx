// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { TuneObject } from "abcjs";
import { useEffect, useRef, useState } from "react";
import { fingerSteps, type Hand } from "../lib/fingering";
import { buildHands } from "../lib/hands";

type OverlayMode = "off" | "names" | "fingers";

const PITCH_CLASSES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const PREF_KEY = "plinky:overlay";

function noteClass(pitch: number): string {
    return PITCH_CLASSES[((pitch % 12) + 12) % 12]!;
}

function loadMode(): OverlayMode {
    try {
        const stored = localStorage.getItem(PREF_KEY);
        return stored === "names" || stored === "fingers" ? stored : "off";
    } catch {
        return "off";
    }
}

function label(element: Element, text: string, color: string): void {
    try {
        const box = (element as unknown as SVGGraphicsElement).getBBox();
        const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
        node.setAttribute("x", String(box.x + box.width / 2));
        node.setAttribute("y", String(box.y + box.height + 13));
        node.setAttribute("text-anchor", "middle");
        node.setAttribute("font-size", "9");
        node.setAttribute("fill", color);
        node.textContent = text;
        element.parentNode?.appendChild(node);
    } catch {
        // getBBox needs layout; skip the overlay where it is unavailable (e.g. jsdom).
    }
}

// Annotate the score with either note names (under every notehead) or suggested
// finger numbers (once per step, on its melody note). Labels are appended beside
// each note element so they inherit its group transform and line up.
function overlay(tune: TuneObject, mode: OverlayMode): void {
    for (const hand of buildHands(tune, 100)) {
        const handType: Hand = hand.label.toLowerCase().includes("left") ? "left" : "right";
        const fingers = mode === "fingers" ? fingerSteps(hand.steps, handType) : null;
        hand.steps.forEach((step, index) => {
            if (fingers) {
                const target = step.elements[0];
                if (target) {
                    label(target, String(fingers[index]), "#16a34a");
                }
                return;
            }
            const name = step.pitches.map(noteClass).join("/");
            for (const element of step.elements) {
                label(element, name, "#4f46e5");
            }
        });
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
    const [mode, setMode] = useState<OverlayMode>("off");

    useEffect(() => {
        setMode(loadMode());
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
                if (mode !== "off") {
                    overlay(tunes[0], mode);
                }
            }
        });
        return () => {
            cancelled = true;
        };
    }, [abcTune, onRender, mode]);

    const changeMode = (next: OverlayMode) => {
        setMode(next);
        try {
            localStorage.setItem(PREF_KEY, next);
        } catch {
            // Preference persistence is best-effort.
        }
    };

    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                Overlay
                <select
                    value={mode}
                    onChange={(event) => changeMode(event.target.value as OverlayMode)}
                    className="rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700"
                >
                    <option value="off">None</option>
                    <option value="names">Note names</option>
                    <option value="fingers">Fingering</option>
                </select>
            </label>
            {/* The score keeps a white "paper" background in every theme so the black
                notation stays readable in dark mode. */}
            <div ref={abcElement} className="rounded bg-white p-2" />
        </div>
    );
}
