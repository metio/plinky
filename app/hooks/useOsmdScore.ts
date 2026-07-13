// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { stripBeams } from "../../core/beams";
import { BOOMWHACKER_SET } from "../../core/pitchColor";
import type { MeasureBox } from "../../core/scoreCanvas";
import { transposeMusicXml } from "../../core/transpose";
import { usePrefsStore, useXmlCodec } from "../contexts/services";
import { annotateFingerings } from "../lib/fingerScore";
import { collectMeasureBoxes } from "../lib/scoreColor";
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
    // Bumped after every successful render (a reload or an in-place fingering redraw), so
    // an overlay that OSMD's fresh SVG drops — the loop selection — can be repainted.
    renderVersion: number;
};

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
        colorNotes,
        showFingerings,
        scrollFollow,
        onReload,
        onRendered,
    }: {
        xml: string;
        // Semitone shift; rewrites the MusicXML before OSMD loads it, so playback, the
        // printed key and the matcher all follow.
        transpose: number;
        // Draw the player's worked-out fingering instead of the app's suggestion.
        showMine: boolean;
        saved: FingerMap;
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
    },
): OsmdScore {
    const prefsStore = usePrefsStore();
    const xmlCodec = useXmlCodec();
    const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
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

    const getOsmd = useCallback(() => osmdRef.current, []);
    const measureBoxes = useCallback(() => measureBoxesRef.current, []);
    const markPainted = useCallback(() => {
        paintedRef.current = true;
    }, []);
    const painted = useCallback(() => paintedRef.current, []);
    const resetPaint = useCallback(() => {
        paintedRef.current = false;
    }, []);

    const centerCursor = useCallback(() => {
        if (!treadmill) {
            return;
        }
        const el = osmdRef.current?.cursor?.cursorElement;
        const box = containerRef.current;
        if (el && box) {
            box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2, behavior: "smooth" });
        }
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
                if (cancelled || !containerRef.current) {
                    return;
                }
                const osmd = new OpenSheetMusicDisplay(containerRef.current, {
                    autoResize: true,
                    drawingParameters: "compact",
                    // Scroll the staff to keep the cursor in view as it advances, so a
                    // multi-line piece follows along while you play instead of forcing
                    // you to scroll — critical on a phone where the staff is tall. The
                    // treadmill drives its own horizontal centring, so OSMD's vertical
                    // follow is turned off there.
                    followCursor: scrollFollowRef.current && !treadmill,
                    // One continuous horizontal staffline that scrolls right, rather than
                    // wrapping into rows — the treadmill reading mode.
                    renderSingleHorizontalStaffline: treadmill,
                    // The Boomwhacker reading aid: colour each notehead (and its stem) by
                    // note name so a beginner reads pitch by hue. OSMD's CustomColorSet
                    // handles hollow vs. solid noteheads itself, and the feedback halos ride
                    // behind the notes, so this leaves both untouched. Off is the default
                    // black notation (XML colour).
                    coloringEnabled: colorNotes,
                    coloringMode: colorNotes ? ColoringModes.CustomColorSet : ColoringModes.XML,
                    coloringSetCustom: colorNotes ? BOOMWHACKER_SET : undefined,
                    colorStemsLikeNoteheads: colorNotes,
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
                const source = showBeams ? annotated : stripBeams(xmlCodec, annotated);
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
        colorNotes,
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
    useEffect(() => {
        const osmd = osmdRef.current;
        if (!osmd || !ready) {
            return;
        }
        const rules = (osmd as unknown as { rules: { RenderFingerings: boolean } }).rules;
        if (rules.RenderFingerings === showFingerings) {
            return;
        }
        rules.RenderFingerings = showFingerings;
        // Remember where the cursor stands and whether a run or Listen is driving it, so it
        // resumes on the same note: updateGraphic() re-initialises the cursor to the start.
        const cursor = osmd.cursor;
        const wasVisible = !cursor.hidden;
        const at = cursor.iterator?.currentTimeStamp?.RealValue ?? 0;
        osmd.updateGraphic();
        osmd.render();
        // A fresh render carries no measure boxes or overlay: re-measure the bars for the
        // loop selection and click-to-select, and drop the paint flag. The render-version
        // bump lets the caller repaint the loop overlay the fresh SVG dropped.
        const svg = containerRef.current?.querySelector("svg");
        measureBoxesRef.current =
            svg instanceof SVGSVGElement ? collectMeasureBoxes(osmd, svg) : [];
        paintedRef.current = false;
        // Step the reset cursor back to where it stood — OSMD has no direct seek — and show
        // it again where a run or Listen was using it, re-centring the treadmill.
        if (wasVisible) {
            seekToWhole(cursor, at);
            cursor.show();
            centerCursor();
        }
        setRenderVersion((version) => version + 1);
    }, [showFingerings, ready, centerCursor, containerRef]);

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
        renderVersion,
    };
}
