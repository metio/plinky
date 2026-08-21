// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { stripAccompaniment } from "../../core/accompaniment";
import { stripBeams } from "../../core/beams";
import { BOOMWHACKER_SET } from "../../core/pitchColor";
import type { MeasureBox } from "../../core/scoreCanvas";
import { transposeMusicXml } from "../../core/transpose";
import { usePrefsStore, useXmlCodec } from "../contexts/services";
import { annotateFingerings } from "../lib/fingerScore";
import { collectMeasureBoxes, restoreNotePaint, snapshotNotePaint } from "../lib/scoreColor";
import { seekToWhole } from "../lib/scoreCursor";
import type { FingerMap } from "../stores/fingeringStore";

// The score-rendering surface: loads a MusicXML piece into OpenSheetMusicDisplay,
// re-renders it when a reading-mode input changes, and reports what the rest of the
// play surface reads off it — the OSMD instance, whether it's ready, the staff and bar
// counts, and each bar's measured box. OSMD is the one part of the play surface that is
// genuinely tied to the DOM and the cursor, so this is where that coupling lives; the
// transports and the matcher drive it through getOsmd().
export type OsmdScore = {
    // The live OSMD instance, or null before the first load. A stable reader so the
    // transports can reach the cursor without a fresh closure per render.
    getOsmd: () => OpenSheetMusicDisplay | null;
    // True once a piece has loaded and rendered; false while a fresh load is in flight.
    ready: boolean;
    // A failed chunk import or unloadable MusicXML, so the viewer can explain itself
    // rather than sit silently dead.
    loadError: boolean;
    // The score's staff count — a grand staff (2) can be drilled one hand at a time.
    staffCount: number;
    // The number of bars, for the loop range and the click-to-select bounds.
    measureCount: number;
    // Each bar's rendered box, measured off the latest render, for the loop overlay and
    // mapping a click on the score to the bar under it. A stable reader over a ref.
    measureBoxes: () => MeasureBox[];
    // Centre the active bar horizontally in treadmill mode — the fixed gaze the music
    // slides under. A no-op when not treadmill or the cursor isn't shown.
    centerCursor: () => void;
    // Flag that something has coloured the score (a run trail, a Listen trail, a keep-up
    // window), so the next run re-renders to wipe it only when there is something to clear.
    markPainted: () => void;
    painted: () => boolean;
    resetPaint: () => void;
    // Re-render to wipe the injected feedback halos, repainting the loop overlay too.
    wipePaint: () => void;
    // Bumped after every successful render (a reload or an in-place fingering redraw), so
    // an overlay that OSMD's fresh SVG drops — the loop selection — can be repainted.
    renderVersion: number;
};

// How the noteheads are coloured, as the options OSMD wants — one definition, so the fresh
// load and the in-place toggle cannot come to disagree about what "on" means.
//
// The enum arrives with the engraver, which is imported on demand to keep it out of the
// bundle every page pays for, so it is handed in rather than imported here.
type ColoringModesEnum = { CustomColorSet: unknown; XML: unknown };

function colorOptions(on: boolean, modes: ColoringModesEnum) {
    return {
        coloringEnabled: on,
        coloringMode: (on ? modes.CustomColorSet : modes.XML) as never,
        coloringSetCustom: on ? BOOMWHACKER_SET : undefined,
        colorStemsLikeNoteheads: on,
    };
}

export function useOsmdScore(
    containerRef: RefObject<HTMLDivElement | null>,
    {
        xml,
        transpose,
        showMine,
        saved,
        barsPerRow,
        noteScale,
        barNumbers,
        treadmill,
        showBeams,
        showAccompaniment,
        colorNotes,
        focus,
        showFingerings,
        scrollFollow,
        onReload,
        onRendered,
        onFingeringRedraw,
    }: {
        xml: string;
        // Semitone shift; rewrites the MusicXML before OSMD loads it, so playback, the
        // printed key and the matcher all follow.
        transpose: number;
        // Draw the player's worked-out fingering instead of the app's suggestion.
        showMine: boolean;
        saved: FingerMap;
        // Draw only this stretch of bars (1-based, inclusive), re-engraved on its own
        // with its clef, key and metre restated — the loop range read as if it were the
        // whole piece. Null draws everything.
        //
        // The cursor still walks the entire sheet; only the drawing is narrowed. Notes
        // outside the range therefore have no rendered element, which the collectors
        // already tolerate — they keep a step's place even when it drew no glyph, so
        // step indices stay aligned with the matcher's.
        focus: { from: number; to: number } | null;
        // Bars forced onto each staff row (0 = fit to width).
        barsPerRow: number;
        // Magnification applied to the whole rendered score (1 = normal), via OSMD's Zoom.
        noteScale: number;
        barNumbers: boolean;
        // One continuous horizontal staffline that scrolls, rather than wrapping to rows.
        treadmill: boolean;
        // Whether fast notes are joined into beam groups; when false the score's <beam>
        // elements are stripped before OSMD loads it, so short notes render with flags.
        // The effective value is decided per piece by beamsVisible before it reaches here.
        showBeams: boolean;
        // Whether a multi-part score keeps its other parts. When false they are removed
        // before OSMD loads the sheet, so the cursor, the matcher and every staff index
        // downstream see the piano's grand staff exactly as a solo piece gives them.
        showAccompaniment: boolean;
        // Colour the noteheads by note name (the Boomwhacker reading aid), off = black.
        colorNotes: boolean;
        // Whether the printed fingering is drawn — flipped in place without a reload.
        showFingerings: boolean;
        // Whether the staff scrolls to keep the played note in view.
        scrollFollow: boolean;
        // Stop any playback before a fresh load, or a layout change mid-run would strand
        // its running state with the timers gone. Called at the start of every reload.
        onReload: () => void;
        // After a reload's render: the bar count, and whether this is a genuinely new piece
        // (as opposed to a relayout of the same one) so the caller can reseed piece-bound
        // state (the practised hand, the loop range) only when the piece itself changes.
        onRendered: (info: { bars: number; freshPiece: boolean }) => void;
        // After the in-place fingering redraw rebuilds the noteheads (mid-run, no reload),
        // so the caller can re-apply any SVG-injected run paint the fresh render dropped —
        // the ear-mode conceal above all, whose blanks would otherwise expose the answers.
        onFingeringRedraw: () => void;
    },
): OsmdScore {
    const prefsStore = usePrefsStore();
    const xmlCodec = useXmlCodec();
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
    // The engraver's colouring enum, kept from the on-demand import for the toggle below.
    const coloringModesRef = useRef<ColoringModesEnum | null>(null);
    // The colouring the loaded sheet was drawn with, so the toggle acts on a real change and
    // never rebuilds the graphic model straight after a reload that already applied it.
    const appliedColorRef = useRef(colorNotes);
    // Read live by the loader: colouring is no longer a reload input, so the value captured
    // when the reload was scheduled could be a toggle or two out of date by the time the
    // engraver arrives.
    const colorNotesRef = useRef(colorNotes);
    colorNotesRef.current = colorNotes;
    const [ready, setReady] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [staffCount, setStaffCount] = useState(1);
    const [measureCount, setMeasureCount] = useState(1);
    const [renderVersion, setRenderVersion] = useState(0);
    const measureBoxesRef = useRef<MeasureBox[]>([]);
    const paintedRef = useRef(false);
    // The last piece a reload seeded piece-bound state for, so a relayout of the same
    // piece leaves it untouched while a genuinely new piece reseeds it.
    const loadedXmlRef = useRef<string | null>(null);

    // The fingering and follow-cursor toggles are applied to OSMD in place (no reload),
    // so a reload driven by another input must still honour the live value — carried into
    // the render's constructor through a ref.
    const showFingeringsRef = useRef(showFingerings);
    showFingeringsRef.current = showFingerings;
    const scrollFollowRef = useRef(scrollFollow);
    scrollFollowRef.current = scrollFollow;

    // The coordination callbacks reference transports and state created after this hook;
    // held in refs so the render effects can call the latest without depending on them.
    const onReloadRef = useRef(onReload);
    onReloadRef.current = onReload;
    const onRenderedRef = useRef(onRendered);
    onRenderedRef.current = onRendered;
    const onFingeringRedrawRef = useRef(onFingeringRedraw);
    onFingeringRedrawRef.current = onFingeringRedraw;

    const getOsmd = useCallback(() => osmdRef.current, []);
    const measureBoxes = useCallback(() => measureBoxesRef.current, []);
    const markPainted = useCallback(() => {
        paintedRef.current = true;
    }, []);
    const painted = useCallback(() => paintedRef.current, []);
    const resetPaint = useCallback(() => {
        paintedRef.current = false;
    }, []);

    // Wipe the injected paint (feedback halos) by re-rendering the score's SVG, then bump
    // the render version. A bare render() rebuilds the SVG and so also drops any other
    // overlay injected into it — the loop's selection rects — and the version bump is what
    // tells their owner (useLoopSelection) to repaint them. Callers that render directly to
    // clear stale halos must go through this, or the loop overlay silently vanishes.
    const wipePaint = useCallback(() => {
        const osmd = osmdRef.current;
        if (!osmd) {
            return;
        }
        osmd.render();
        paintedRef.current = false;
        setRenderVersion((version) => version + 1);
    }, []);

    // Follow the note: scroll so the cursor's note stays centred as the run advances.
    // One mechanism for both layouts — `scrollIntoView` walks every scrollable ancestor,
    // so it centres whether the page scrolls (at rest) or the fullscreen container does,
    // and we own it outright (OSMD's own followCursor is off) so the two never fight. The
    // treadmill scrolls horizontally under a fixed gaze; the wrapped layout scrolls
    // vertically to the current staff row. Off only when the player turns follow off.
    // Keep the note being played in view — by scrolling the SCORE, never the page.
    //
    // `scrollIntoView` walks up every scrollable ancestor, and outside the playing surface
    // the outermost of those is the document: listening to a piece while reading something
    // else on the page dragged the whole thing away, once per note. The score box is its own
    // scroller, so moving that alone follows the music and leaves the reader where they are.
    const centerCursor = useCallback(() => {
        const box = containerRef.current;
        const el = osmdRef.current?.cursor?.cursorElement;
        if (!scrollFollowRef.current || !box || !el) {
            return;
        }
        const boxAt = box.getBoundingClientRect();
        const elAt = el.getBoundingClientRect();
        // The treadmill lays the music out in one line and scrolls sideways; everything else
        // wraps into systems and scrolls down.
        box.scrollBy(
            treadmill
                ? {
                      left: elAt.left - boxAt.left - (boxAt.width - elAt.width) / 2,
                      behavior: "smooth",
                  }
                : {
                      top: elAt.top - boxAt.top - (boxAt.height - elAt.height) / 2,
                      behavior: "smooth",
                  },
        );
    }, [treadmill, containerRef]);

    // Reload OSMD whenever the score or a reading-mode input changes, stopping any
    // playback/practice first (a layout change mid-run would otherwise strand its running
    // state, the Stop label and the ticking metronome, with the timers gone).
    // biome-ignore lint/correctness/useExhaustiveDependencies: onReload/onRendered run through refs; prefsStore/xmlCodec are stable
    useEffect(() => {
        let cancelled = false;
        setReady(false);
        setLoadError(false);
        paintedRef.current = false;
        onReloadRef.current();
        import("opensheetmusicdisplay")
            .then(({ ColoringModes, OpenSheetMusicDisplay }) => {
                // Kept for the colour toggle below, which runs long after this import.
                coloringModesRef.current = ColoringModes;
                appliedColorRef.current = colorNotesRef.current;
                if (cancelled || !containerRef.current) {
                    return;
                }
                const osmd = new OpenSheetMusicDisplay(containerRef.current, {
                    autoResize: true,
                    drawingParameters: "compact",
                    // Focus mode: OSMD draws only this range, restating the clef, key
                    // and metre at its start, so a handful of bars can be read as a
                    // piece in their own right instead of hunted for on a full page.
                    ...(focus
                        ? {
                              drawFromMeasureNumber: focus.from,
                              drawUpToMeasureNumber: focus.to,
                          }
                        : {}),
                    // We own follow-the-note scrolling ourselves (centerCursor centres the
                    // current note in whatever scrolls, in both layouts), so OSMD's own
                    // follow stays off — two mechanisms would fight over the scroll position.
                    followCursor: false,
                    // One continuous horizontal staffline that scrolls right, rather than
                    // wrapping into rows — the treadmill reading mode.
                    renderSingleHorizontalStaffline: treadmill,
                    // The Boomwhacker reading aid: colour each notehead (and its stem) by
                    // note name so a beginner reads pitch by hue. OSMD's CustomColorSet
                    // handles hollow vs. solid noteheads itself, and the feedback halos ride
                    // behind the notes, so this leaves both untouched. Off is the default
                    // black notation (XML colour).
                    ...colorOptions(colorNotesRef.current, ColoringModes),
                });
                osmdRef.current = osmd;
                const rules = (
                    osmd as unknown as {
                        rules: {
                            RenderXMeasuresPerLineAkaSystem: number;
                            RenderMeasureNumbers: boolean;
                            RenderMeasureNumbersOnlyAtSystemStart: boolean;
                            RenderFingerings: boolean;
                        };
                    }
                ).rules;
                // Force a fixed number of bars per row when the player picks one, for
                // bigger, more readable notation on a small screen; 0 fits them to width.
                rules.RenderXMeasuresPerLineAkaSystem = barsPerRow;
                // Number the first bar of each row when bar numbers are on, so the same
                // rows are labelled every render; OSMD's default cadence otherwise moves
                // the numbers around as the score re-flows.
                rules.RenderMeasureNumbers = barNumbers;
                rules.RenderMeasureNumbersOnlyAtSystemStart = true;
                // Whether the printed fingering is drawn. The numbers are always baked into
                // the sheet below, so flipping this rule and re-rendering shows or hides them
                // without a reload — see the fingering-toggle effect. Set from a ref so a
                // reload driven by another input still honours the live toggle.
                rules.RenderFingerings = showFingeringsRef.current;
                // Magnify the whole score for a player who needs bigger glyphs; applied
                // before render and re-applied on every reload, and it scales the notation
                // in treadmill mode too, where bars-per-row has no effect.
                osmd.Zoom = noteScale;
                // Suggested fingering belongs on the staff, personalised to the player's
                // reach, so the suggestion sits on the note being read, not mapped onto a
                // key. Transpose first, then annotate, so the printed fingering is computed
                // for the key actually being played. It is always baked in — drawn or not
                // per the rule above — so the toggle can redraw rather than reload.
                const transposed =
                    transpose === 0 ? xml : transposeMusicXml(xmlCodec, xml, transpose);
                const annotated = annotateFingerings(
                    xmlCodec,
                    transposed,
                    prefsStore.load().handSpan,
                    showMine ? saved : undefined,
                );
                // Drop the beams last, so short notes render with flags instead of
                // beat groups — an easier read for a beginner. Notes and durations are
                // untouched, so playback, timing and matching are unaffected.
                const played = showAccompaniment
                    ? annotated
                    : stripAccompaniment(xmlCodec, annotated);
                const source = showBeams ? played : stripBeams(xmlCodec, played);
                return osmd.load(source).then(() => {
                    if (cancelled) {
                        return;
                    }
                    osmd.render();
                    // Measure every bar's box off the fresh render, for the loop's
                    // selection overlay and click-to-select. The cursor is free here
                    // (nothing is playing), and a fresh render carries no selection.
                    const svg = containerRef.current?.querySelector("svg");
                    measureBoxesRef.current =
                        svg instanceof SVGSVGElement ? collectMeasureBoxes(osmd, svg) : [];
                    // A grand staff (two staves) can be drilled one hand at a
                    // time; a single-staff score offers no such choice.
                    setStaffCount(osmd.Sheet?.getCompleteNumberOfStaves() ?? 1);
                    const bars = osmd.Sheet?.SourceMeasures?.length ?? 1;
                    setMeasureCount(bars);
                    const freshPiece = loadedXmlRef.current !== xml;
                    loadedXmlRef.current = xml;
                    onRenderedRef.current({ bars, freshPiece });
                    setReady(true);
                    setRenderVersion((version) => version + 1);
                });
            })
            // A failed chunk import or MusicXML that OSMD can't load would otherwise
            // leave ready false forever — a silently dead viewer with disabled
            // controls and no explanation. Surface it instead.
            .catch(() => {
                if (!cancelled) {
                    setLoadError(true);
                }
            });
        return () => {
            cancelled = true;
            // The effect body stops every playback mode before loading; the timer chains
            // also clear themselves on unmount, so nothing here can fire into a torn-down
            // score. A change of layout (bars-per-row, treadmill, transpose) re-runs this
            // effect, building a fresh OSMD on the same container. OSMD renders into a
            // new SVG rather than replacing the old one, so without removing the previous
            // render its SVG stays behind and each switch stacks another copy. clear()
            // frees OSMD's own state but leaves its <svg> in the DOM, so empty the
            // container too.
            osmdRef.current?.clear();
            containerRef.current?.replaceChildren();
        };
    }, [
        xml,
        transpose,
        showMine,
        saved,
        barsPerRow,
        noteScale,
        barNumbers,
        treadmill,
        showBeams,
        showAccompaniment,
        focus,
    ]);

    // Toggle the on-staff fingering without re-parsing the MusicXML, so the loaded sheet
    // and any run in progress survive — the player can switch fingering on and off mid-play.
    // The numbers are always baked into the loaded sheet; flipping OSMD's RenderFingerings
    // rule alone isn't enough, because a bare render() repositions the cached fingering
    // labels but never destroys them, leaving stale numbers over the reclaimed space when
    // switching off. updateGraphic() rebuilds the graphic model from the parsed sheet, so
    // the labels are created afresh per the rule — all when on, none when off. The reload
    // effect sets the rule to the live toggle on every fresh render, so this acts only on a
    // real change and never fires a redundant rebuild straight after a reload.
    // Redraw the sheet WITHOUT re-parsing it, for a setting that changes only how the music
    // is drawn rather than what it contains.
    //
    // Re-parsing is the expensive path and the disruptive one: it clears the sheet, which
    // collapses the score box, which on the piece's own page jumps the reader's scroll
    // position to somewhere else entirely. It also throws away the run in progress. So a
    // rule that only affects drawing is applied to the loaded sheet and the graphic model
    // rebuilt around it — which does mean carrying the state a fresh render drops.
    const redrawInPlace = useCallback(
        (apply: () => void) => {
            const osmd = osmdRef.current;
            // `ready` is the value from THIS render, and a reload beginning in the same
            // commit has already cleared the sheet in its cleanup — so it can still read
            // true over an OSMD with nothing in it, and updateGraphic() below would walk
            // undefined staves. Nothing is lost by standing down: the reload applies every
            // one of these rules itself, from a ref, so the value in force is the live one
            // either way.
            if (!osmd || !ready || !osmd.Sheet) {
                return;
            }
            apply();
            // Remember where the cursor stands and whether a run or Listen is driving it, so
            // it resumes on the same note: updateGraphic() re-initialises it to the start.
            const cursor = osmd.cursor;
            const wasVisible = !cursor.hidden;
            const at = cursor.iterator?.currentTimeStamp?.RealValue ?? 0;
            // Capture the run's paint before the render drops every halo, to re-apply after —
            // the green cleared notes and the blue Listen trail record how far the piece has
            // been played, and would otherwise vanish on a mid-run toggle.
            const paint = snapshotNotePaint(osmd);
            osmd.updateGraphic();
            osmd.render();
            // A fresh render carries no measure boxes or overlay: re-measure the bars for the
            // loop selection and click-to-select. The render-version bump lets the caller
            // repaint the loop overlay the fresh SVG dropped.
            const svg = containerRef.current?.querySelector("svg");
            measureBoxesRef.current =
                svg instanceof SVGSVGElement ? collectMeasureBoxes(osmd, svg) : [];
            paintedRef.current = restoreNotePaint(osmd, paint);
            onFingeringRedrawRef.current();
            // Step the reset cursor back to where it stood — OSMD has no direct seek — and
            // show it again where a run or Listen was using it, re-centring the treadmill.
            if (wasVisible) {
                seekToWhole(cursor, at);
                cursor.show();
                centerCursor();
            }
            setRenderVersion((version) => version + 1);
        },
        [ready, centerCursor, containerRef],
    );

    // The on-staff fingering. The numbers are always baked into the loaded sheet; flipping
    // OSMD's RenderFingerings rule alone isn't enough, because a bare render() repositions
    // the cached fingering labels but never destroys them, leaving stale numbers over the
    // reclaimed space when switching off. updateGraphic() rebuilds the graphic model from
    // the parsed sheet, so the labels are created afresh per the rule — all when on, none
    // when off.
    useEffect(() => {
        const rules = (osmdRef.current as unknown as { rules?: { RenderFingerings: boolean } })
            ?.rules;
        // The reload sets this rule on every fresh render, so this acts only on a real
        // change and never fires a redundant rebuild straight after a reload.
        if (!rules || rules.RenderFingerings === showFingerings) {
            return;
        }
        redrawInPlace(() => {
            rules.RenderFingerings = showFingerings;
        });
    }, [showFingerings, redrawInPlace]);

    // Colouring the noteheads by pitch. A drawing rule like the fingering above, and it used
    // to force a full re-parse — which on the piece's own page threw the reader's scroll
    // position across the document every time the toggle was pressed.
    useEffect(() => {
        const osmd = osmdRef.current;
        const modes = coloringModesRef.current;
        if (!osmd || !modes || appliedColorRef.current === colorNotes) {
            return;
        }
        appliedColorRef.current = colorNotes;
        redrawInPlace(() => {
            osmd.setOptions(colorOptions(colorNotes, modes));
        });
    }, [colorNotes, redrawInPlace]);

    return {
        getOsmd,
        ready,
        loadError,
        staffCount,
        measureCount,
        measureBoxes,
        centerCursor,
        markPainted,
        painted,
        resetPaint,
        wipePaint,
        renderVersion,
    };
}
