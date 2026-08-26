// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { usePrefsStore } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { ScoreSkeleton } from "../ui/scoreSkeleton";
import { KeyboardQuickControls } from "./keyboardQuickControls";
import { NotesHighway } from "./notesHighway";
import { usePlaySession } from "./playSession";

// The score itself: the bordered scroll box OSMD renders into, the staff that stands in
// while it fills, plus the load-error notice.
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
        keepUp,
        loop,
        title,
        hideKeyboard,
        setHideKeyboard,
        fingerStrip,
        setNoteHints,
        keyRange,
        aids,
        sightRead,
    } = usePlaySession();
    const prefsStore = usePrefsStore();
    // In the notes-highway reading mode, a tall highway covers the staff — OSMD stays
    // mounted and rendered underneath (the cursor keeps walking it), so the staff is
    // hidden, not unmounted.
    //
    // Full screen is the session: it is entered to play or to listen, and it is left to
    // read, loop and set the piece up. So the reading mode holds for as long as the player
    // is in there, rather than only while something is moving — tying it to movement meant
    // the view flipped to the staff every time they paused, which is a reading mode that
    // keeps being taken away rather than one they chose.
    //
    // Full screen is also the ONLY place it appears. Listening from the piece's own page is
    // reading, not playing — somebody there wants the score in front of them, and replacing
    // it with falling blocks answers a question they did not ask. The reading mode belongs
    // to the playing surface.
    //
    // It also hands the staff back when there is nothing ahead to draw: the piece has run
    // out, and the result belongs on the score anyway.
    const somethingAhead = matcher.upcoming.length > 0;
    const highwayActive = aids.highway && somethingAhead && fullscreen;
    // The score slot's size: full screen hands it the spare height (flex-1); a phone gets
    // a fixed slice so the keys still fit; otherwise a tall band that scrolls if taller.
    // The highway takes this same slot so it stands exactly where the staff did.
    const slotSize = fullscreen
        ? "min-h-0 flex-1"
        : compact
          ? "h-[40dvh]"
          : "min-h-[50vh] max-h-[70vh]";
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
        //
        // The plate spans the whole screen below `sm`, cancelling the page's own padding
        // with a negative margin. Not a cosmetic choice: how much music fits on a row is a
        // STEP rather than a slope — nothing improves until the usable width crosses the
        // point where another bar fits, and then it improves all at once. Measured on a
        // 24-bar piano score at 393px, the step sits between 357px and 369px of usable
        // width, and the page's padding plus the plate's own left 321px. Full-bleed leaves
        // 369px — the plate keeps its p-3, the page's 24px goes to the music — and the same
        // score draws in 2526px instead of 4665px, about two bars a row instead of one, at
        // exactly the same note size.
        //
        // Which is why the padding here cannot be tuned by eye: giving half of it back puts
        // the width at 345px and buys precisely nothing. scoreDensity.browser.test.tsx pins
        // the step so a later tidy-up of page padding fails a gate rather than silently
        // halving the music on screen.
        <div
            className={`relative -mx-6 rounded-xl bg-paper p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_12px_32px_-14px_rgba(0,0,0,0.20)] sm:mx-0 ${
                fullscreen ? "flex min-h-0 flex-1 flex-col" : ""
            }`}
        >
            {/* The engraver's plate rule: a single hairline inset within the padding,
            between the page edge and the staff. Decorative, so it never takes a press. */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-2 rounded-lg border border-paper-line/70"
            />
            {/* In highway mode the highway takes the staff's slot as an in-flow panel,
            so it gets its height the same way the staff did (the flex-1 / min-h band
            below) rather than depending on an absolute layer stretching. It is an opaque
            field, so nothing shows through around the centred lane; the staff's own box
            is pulled out of flow and hidden (see the container below), kept mounted only
            so OSMD stays rendered and the matcher's cursor keeps walking it. */}
            {highwayActive && (
                <div className={`relative overflow-hidden rounded-md bg-subtle ${slotSize}`}>
                    <div className="absolute inset-0">
                        <NotesHighway
                            upcoming={matcher.upcoming}
                            from={keyRange.from}
                            to={keyRange.to}
                            // Only the tempo-locked play-along has a clock. Self-paced
                            // practice waits for the player, and a picture that fell
                            // anyway would leave them behind their own notes.
                            advanceMs={keepUp.running ? keepUp.stepMs : null}
                        />
                    </div>
                </div>
            )}
            {fullscreen && !fingerStrip && (
                <KeyboardQuickControls
                    floating
                    hidden={hideKeyboard}
                    onToggleHidden={() => setHideKeyboard((on) => !on)}
                    noteLabels={aids.noteLabels}
                    onNoteLabels={(value) =>
                        prefsStore.save({ ...prefsStore.load(), noteLabels: value })
                    }
                    noteHints={aids.noteHints}
                    onNoteHints={setNoteHints}
                    instrumentSounds={prefsStore.load().instrumentSounds}
                    onInstrumentSounds={(value) =>
                        prefsStore.save({ ...prefsStore.load(), instrumentSounds: value })
                    }
                />
            )}
            {/* The study countdown: the score is up and the run has not begun, so the
            piece can be taken in — key, metre, shape — before the first note. Announced
            politely so a screen reader hears the time left without the run being
            interrupted on every tick. */}
            {sightRead.countdown !== null && (
                <p
                    role="status"
                    aria-live="polite"
                    className="rounded-lg bg-accent-surface px-3 py-2 text-center text-sm font-medium text-accent-strong"
                >
                    {m.sight_read_studying({ seconds: sightRead.countdown })}
                </p>
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
                //
                // In highway mode this box is pulled out of flow — a 1px, clipped,
                // transparent strip spanning the frame's width — so it keeps its layout
                // width (OSMD lays the score out and the cursor keeps walking) while
                // taking no visible space and painting nothing. The highway panel above
                // stands in the slot instead.
                className={
                    highwayActive
                        ? "no-scrollbar pointer-events-none absolute inset-x-3 top-3 h-px overflow-hidden opacity-0"
                        : `no-scrollbar overflow-auto ${
                              ready &&
                              measureCount > 1 &&
                              !listenPlayback.playing &&
                              !matcher.practicing
                                  ? "cursor-pointer"
                                  : ""
                          } ${slotSize}`
                }
            />
            {/* Engraving a piece takes a second or two on a slow device, and the box it
            renders into stands empty for all of it. The staff stands in over that box —
            over, not in it, because the container belongs to the engraver and anything put
            inside it is swept away on the next render. Nothing here takes a press: the
            score underneath is still the thing being pointed at. */}
            {!ready && !loadError && !highwayActive && (
                <div className="pointer-events-none absolute inset-3">
                    <ScoreSkeleton engraving />
                </div>
            )}
            {loadError && <p className="p-2 text-sm text-danger">{m.score_load_error()}</p>}
        </div>
    );
}
