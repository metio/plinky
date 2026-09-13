// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useId, useMemo, useState } from "react";
import { HOME_OCTAVE, METHODS, METHODS_ANCHOR, methodOnKey } from "../../../core/practiceMethods";
import { useMidiConnection, useHeldNotes } from "../../contexts/midi";
import { useKeyboardFinish, useKeyboardTheme } from "../../hooks/useKeyboardTheme";
import { useNoteLabels } from "../../hooks/useNoteLabels";
import { useNoteNaming } from "../../hooks/useNoteNaming";
import { useVoicedInput } from "../../hooks/useVoicedInput";
import { m } from "../../paraglide/messages.js";
import { type KeyDressing, Keyboard } from "../ui/keyboard";
import { ChordReadout } from "./chordReadout";
import { MidiBadge } from "./midiBadge";
import { Drawing } from "../ui/drawings/drawing";
import { METHOD_DRAWING, METHOD_LABEL, METHOD_NAME, MethodLeaf } from "./practiceMethods";

// The landing page's signature, and its menu of ways to practise: a real keyboard you play
// right here, whose seven white keys each carry one method. It is the same Keyboard component
// and input funnel the practice modes use, so the instrument and its feel are literally the
// same everywhere. A tap or a connected MIDI key presses a live voice that rings for exactly
// as long as it is held and lights the key green while down; a white key also opens its
// method in the leaf below. The black keys only sound. The keys rise in a one-time ripple on
// load; that and the press are the only motion, both dropped for reduce-motion.
//
// Nothing sounds on hover. Only a key that is pressed makes a note.
//
// `children` sits between the keys and the leaf, for whatever the page says about the keys.
export function HeroKeyboard({ children }: { children?: ReactNode }) {
    const labels = useNoteLabels();
    const naming = useNoteNaming();
    const theme = useKeyboardTheme();
    const finish = useKeyboardFinish();
    // The shared input funnel: touch taps and a connected MIDI keyboard both flow through
    // it, and heldNotes is the single source of truth for which keys are down (and lit).
    const { pressKey, releaseKey } = useMidiConnection();
    const heldNotes = useHeldNotes();
    // Which key's method the leaf shows. Before any press it is the first key's, C: the
    // keyboard arrives already saying what its keys are for, and an empty leaf would hold the
    // seven methods back until somebody guessed that a piano key opens something.
    const [openKey, setOpenKey] = useState<number>(HOME_OCTAVE.from);
    const leafId = useId();

    // Sound the app's own piano voice for whatever the funnel reports, so the hold shapes
    // the sound exactly as it does in the trainer. Notes outside this octave (from a full
    // MIDI keyboard) still sound, and so do the pedals. A key still held when the hero
    // unmounts, drawn or on a MIDI piano, has its voice ended there too.
    //
    // Each note-on also opens the method on its key. A tap, a computer key and a MIDI piano
    // all arrive through the one funnel, so this one observer serves all three, and the
    // voice is exactly what it was: opening a method is something the note does as well.
    useVoicedInput({
        onNoteOn: (event) => {
            if (methodOnKey(event.note)) {
                setOpenKey(event.note);
            }
        },
    });

    const dressing = useMemo(
        () =>
            new Map<number, KeyDressing>(
                METHODS.map((method) => {
                    return [
                        method.key,
                        {
                            label: METHOD_LABEL[method.id](),
                            name: METHOD_NAME[method.id](),
                            picture: (
                                <Drawing
                                    name={METHOD_DRAWING[method.id]}
                                    className="h-auto w-7 sm:w-9"
                                />
                            ),
                            controls: leafId,
                            open: method.key === openKey,
                        },
                    ];
                }),
            ),
        [leafId, openKey],
    );
    const method = methodOnKey(openKey);

    return (
        <div id={METHODS_ANCHOR} className="mx-auto w-full max-w-xl scroll-mt-24 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="font-display text-lg font-medium text-ink">{m.methods_title()}</h3>
                <p className="text-sm text-muted">{m.methods_press()}</p>
            </div>
            <Keyboard
                finish={finish}
                from={HOME_OCTAVE.from}
                to={HOME_OCTAVE.to}
                lit={new Set(heldNotes)}
                rise
                labels={labels}
                naming={naming}
                well="w-full"
                bed="h-48 sm:h-52"
                maxKeyPx={80}
                theme={theme}
                badge={<MidiBadge />}
                dressing={dressing}
                onPress={pressKey}
                onRelease={releaseKey}
            />
            {/* What the hands are holding, named as they hold it. The keyboard is already
                here to be pressed for its own sake; saying what came out turns idle
                noodling into the one lesson nobody can look up — you cannot search for a
                sound you have no name for. */}
            <ChordReadout notes={heldNotes} naming={naming} />
            {children}
            {/* Focus stays on the key that was pressed: the key is an instrument first, and
                taking the focus away would end a run of notes at the first one. The leaf is
                the next stop in the tab order after the keybed, so Tab reaches its action. */}
            {method && <MethodLeaf id={leafId} method={method} />}
        </div>
    );
}
