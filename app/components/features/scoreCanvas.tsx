// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { usePrefsStore } from "../../contexts/services";
import { useNoteLabels } from "../../hooks/useNoteLabels";
import { m } from "../../paraglide/messages.js";
import { KeyboardQuickControls } from "./keyboardQuickControls";
import { NotesHighway } from "./notesHighway";
import { usePlaySession } from "./playSession";

// The score itself: the bordered scroll box OSMD renders into, plus the load-error notice.
// It attaches the session's container ref (OSMD renders here) and forwards a click to the
// loop's bar picker; everything about what's drawn lives in the session's render surface.
// In full screen the keyboard's quick controls ride this box's corner rather than taking
// a row of their own, so folding the keys away hands their whole strip to the score.
export function ScoreCanvas() {
    const {
        containerRef,
        fullscreen,
        compact,
        ready,
        measureCount,
        loadError,
        matcher,
        listenPlayback,
        loop,
        title,
        hideKeyboard,
        setHideKeyboard,
        fingerStrip,
        noteHints,
        setNoteHints,
        reading,
        keyRange,
    } = usePlaySession();
    const prefsStore = usePrefsStore();
    const noteLabels = useNoteLabels();
    // In the notes-highway reading mode, a tall highway covers the staff while playing —
    // OSMD stays mounted and rendered underneath (the matcher walks its cursor), so the
    // staff is hidden, not unmounted. Only while a run is on: at rest the score shows so
    // the piece can be read, looped and set up.
    const highwayActive = reading.highway && matcher.practicing;
    return (
        // OSMD renders to its container's full offset width, which includes any border or
        // padding on that element; were either on the element OSMD owns, the rendered system
        // would overflow by exactly that amount and show a spurious scrollbar. So the frame
        // and breathing room live on the wrapper, and the inner element OSMD measures is
        // clean. Wide scores still scroll horizontally, and that region must be focusable for
        // keyboard users (axe scrollable-region-focusable).
        //
        // The frame reads as a lifted page on a stand rather than a boxed div: a warm
        // paper field, a soft two-layer drop shadow, and a hairline rule inset from the
        // rounded edge — the plate border of an engraved music edition. `relative` anchors
        // that decorative rule.
        <div
            className={`relative rounded-xl bg-stone-50 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-14px_rgba(0,0,0,0.20)] ${
                fullscreen ? "flex min-h-0 flex-1 flex-col" : ""
            }`}
        >
            {/* The engraver's plate rule: a single hairline inset within the padding,
            between the page edge and the staff. Decorative, so it never takes a press. */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-2 rounded-lg border border-stone-300/70"
            />
            {/* The tall highway covers the staff while playing in highway mode. Placed
            before the quick controls so those still paint on top of it; the OSMD box
            below stays laid out and functional, just hidden behind this. */}
            {highwayActive && (
                <div className="pointer-events-none absolute inset-3 overflow-hidden rounded-md">
                    <NotesHighway
                        upcoming={matcher.upcoming}
                        from={keyRange.from}
                        to={keyRange.to}
                    />
                </div>
            )}
            {fullscreen && !fingerStrip && (
                <KeyboardQuickControls
                    floating
                    hidden={hideKeyboard}
                    onToggleHidden={() => setHideKeyboard((on) => !on)}
                    noteLabels={noteLabels}
                    onNoteLabels={(value) =>
                        prefsStore.save({ ...prefsStore.load(), noteLabels: value })
                    }
                    noteHints={noteHints}
                    onNoteHints={setNoteHints}
                />
            )}
            {/* Click a bar to build the loop range; the loop from/to number inputs
            are the keyboard-accessible equivalent, so no key handler is needed. */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: the loop from/to number inputs are the keyboard path */}
            <div
                ref={containerRef}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs keyboard access
                tabIndex={0}
                role="img"
                aria-label={title}
                // Arm on a real pointer press here, then act on the click. A compatibility
                // click that retargets onto the score when the keyboard unmounts at a run's
                // end carries no press, so it never builds a loop the player didn't ask for.
                onPointerDown={loop.arm}
                onClick={(event) => loop.selectBarAt(event.clientX, event.clientY)}
                // A bounded scroll box so the follow-cursor scrolls the staff inside
                // it — keeping the controls and on-screen keyboard in view below
                // rather than scrolling the whole page out from under them. Full screen
                // hands it all the spare height (flex-1); otherwise it's shorter on a
                // phone so the keys fit; dvh tracks the live viewport so the mobile URL
                // bar doesn't clip it.
                // The min-height reserves the staff area before OSMD has
                // rendered, so the score growing in on load doesn't shove the
                // controls and keyboard below it down the page (a CLS hit that
                // Lighthouse amplifies under CPU throttling). The max-height keeps
                // it from crowding the keyboard off-screen; taller scores scroll.
                className={`no-scrollbar overflow-auto ${
                    ready && measureCount > 1 && !listenPlayback.playing && !matcher.practicing
                        ? "cursor-pointer"
                        : ""
                } ${fullscreen ? "min-h-0 flex-1" : compact ? "h-[40dvh]" : "min-h-[50vh] max-h-[70vh]"}`}
            />
            {loadError && (
                <p className="p-2 text-sm text-red-600 dark:text-red-400">{m.score_load_error()}</p>
            )}
        </div>
    );
}
