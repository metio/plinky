// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { usePrefsStore } from "../../contexts/services";
import { useNoteLabels } from "../../hooks/useNoteLabels";
import { m } from "../../paraglide/messages.js";
import { KeyboardQuickControls } from "./keyboardQuickControls";
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
    } = usePlaySession();
    const prefsStore = usePrefsStore();
    const noteLabels = useNoteLabels();
    return (
        // OSMD renders to its container's full offset width, which includes any border or
        // padding on that element; were either on the element OSMD owns, the rendered system
        // would overflow by exactly that amount and show a spurious scrollbar. So the border
        // and breathing room live on the wrapper, and the inner element OSMD measures is
        // clean. Wide scores still scroll horizontally, and that region must be focusable for
        // keyboard users (axe scrollable-region-focusable).
        <div
            className={`rounded-md border border-gray-200 bg-white p-2 dark:border-gray-800 ${
                fullscreen ? "relative flex min-h-0 flex-1 flex-col" : ""
            }`}
        >
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
