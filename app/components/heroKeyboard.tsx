// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { useSynth } from "../hooks/useSynth";
import { noteName } from "../lib/midi";

// Pitch classes of the white keys; everything else is a black key.
const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
const isWhite = (note: number) => WHITE_PITCH_CLASSES.includes(((note % 12) + 12) % 12);

// One octave, C4–C5 — enough to be unmistakably a piano, small enough to sit on a
// phone.
const FROM = 60;
const TO = 72;

const NOTES = Array.from({ length: TO - FROM + 1 }, (_, i) => FROM + i);
const WHITES = NOTES.filter(isWhite);
const BLACKS = NOTES.filter((note) => !isWhite(note));
const WHITE_WIDTH = 100 / WHITES.length;

// The landing page's signature: a real keyboard you play right here. A press sounds
// the app's own piano voice (the Web Audio context wakes on the first key, so it
// costs nothing until touched) and lights the key plink-green. The keys rise in a
// one-time ripple on load; that, and the press, are the only motion, and both are
// dropped for reduce-motion.
export function HeroKeyboard() {
    const synth = useSynth();
    const [lit, setLit] = useState<ReadonlySet<number>>(new Set());

    const plink = (note: number) => {
        synth.playNote(note, { velocity: 100, duration: 1.4 });
        setLit((prev) => new Set(prev).add(note));
        window.setTimeout(() => {
            setLit((prev) => {
                const next = new Set(prev);
                next.delete(note);
                return next;
            });
        }, 240);
    };

    // Pointer for an instant plink; Enter/Space for keyboard players. No onClick, so
    // a mouse press doesn't sound the note twice.
    const onDown = (note: number) => (event: React.PointerEvent) => {
        event.preventDefault();
        plink(note);
    };
    const onKey = (note: number) => (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            plink(note);
        }
    };

    return (
        <div className="mx-auto w-full max-w-md rounded-2xl bg-gray-200 p-3 shadow-inner dark:bg-gray-900">
            <div className="relative h-36 w-full touch-none select-none">
                <div className="flex h-full w-full gap-px">
                    {WHITES.map((note, index) => (
                        <button
                            key={note}
                            type="button"
                            aria-label={noteName(note)}
                            onPointerDown={onDown(note)}
                            onKeyDown={onKey(note)}
                            style={{ animationDelay: `${index * 45}ms` }}
                            className={`relative flex-1 animate-key-rise rounded-b-lg border border-gray-300 shadow-sm transition-[transform,background-color,box-shadow] duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 motion-reduce:animate-none dark:border-gray-700 ${
                                lit.has(note)
                                    ? "translate-y-0.5 bg-green-100 shadow-[0_0_18px_-2px] shadow-green-400 dark:bg-green-900"
                                    : "bg-white hover:bg-gray-50 dark:bg-gray-100 dark:hover:bg-white"
                            }`}
                        />
                    ))}
                </div>
                {BLACKS.map((note) => {
                    const whitesBefore = WHITES.filter((white) => white < note).length;
                    const width = WHITE_WIDTH * 0.62;
                    const left = Math.min(
                        Math.max(0, whitesBefore * WHITE_WIDTH - WHITE_WIDTH * 0.31),
                        100 - width,
                    );
                    return (
                        <button
                            key={note}
                            type="button"
                            aria-label={noteName(note)}
                            onPointerDown={onDown(note)}
                            onKeyDown={onKey(note)}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            className={`absolute top-0 h-2/3 rounded-b-md transition-[transform,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                                lit.has(note)
                                    ? "translate-y-0.5 bg-violet-500 shadow-[0_0_18px_-2px] shadow-violet-500"
                                    : "bg-gray-900 hover:bg-gray-800"
                            }`}
                        />
                    );
                })}
            </div>
        </div>
    );
}
