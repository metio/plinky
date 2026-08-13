// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import type { Take } from "../../../core/takes";
import { fingeredFreely } from "../../../core/scorePerformance";
import { videoDurationMs } from "../../../core/videoFrames";
import { useVideoExporter } from "../../contexts/services";
import { useKeyboardTheme } from "../../hooks/useKeyboardTheme";
import { downloadBlob } from "../../lib/download";
import { buildScoreSnapshot, type OriginalScore } from "../../lib/scoreSnapshot";
import { takeFileStem } from "../../lib/takeFile";
import { takeHighwayPainter, takeScenePainter } from "../../lib/videoPainter";
import {
    DEFAULT_KEYBOARD_DEPTH,
    DEFAULT_NOTE_COLOR,
    KEYBOARD_DEPTHS,
    keyboardDepthFraction,
    NOTE_COLORS,
    BY_FINGER,
    noteColorHex,
} from "../../../core/videoLook";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { Disclosure } from "../ui/disclosure";
import { SegmentedControl } from "../ui/segmentedControl";
import { Switch } from "../ui/switch";

// The base 16:9 sizes per quality step; portrait swaps the axes for the
// vertical feeds (Reels, Shorts, TikTok).
const SIZES = { "720": { width: 1280, height: 720 }, "1080": { width: 1920, height: 1080 } };

// Renders a saved take as an MP4 — the score and/or keyboard playing itself
// with the piece's title and credit burnt in — and downloads it. The Runs tab
// gives the options room: format, quality, frame rate, and which layers the
// stage shows. Only offered where the engine can actually encode one; while
// rendering, the label counts progress so a long take visibly works.
// Named one by one rather than composed from the id: the message gate reads literal
// `m.key` references, and a key built at runtime is invisible to it — which is the point,
// since a message nothing names is a message nobody translates.
const NOTE_COLOR_LABELS: Record<string, () => string> = {
    indigo: m.video_note_color_indigo,
    pink: m.video_note_color_pink,
    teal: m.video_note_color_teal,
    amber: m.video_note_color_amber,
    lime: m.video_note_color_lime,
    finger: m.video_note_color_finger,
};

const DEPTH_LABELS: Record<string, () => string> = {
    shallow: m.video_keyboard_depth_shallow,
    standard: m.video_keyboard_depth_standard,
    deep: m.video_keyboard_depth_deep,
};

export function ExportVideoButton({
    take,
    title,
    credit,
    original = null,
}: {
    take: Take;
    title: string;
    credit: string;
    // The piece's own notation (and the hand it was practised with), when the
    // page knows it — the recognizable score beats a re-engraving of the take.
    original?: OriginalScore | null;
}) {
    const exporter = useVideoExporter();
    // The chosen on-screen keyboard skin, so the exported video's keys match the app.
    const theme = useKeyboardTheme();
    const [supported, setSupported] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    // Staff renders the notation (and/or keyboard); Highway drops the staff for
    // Synthesia-style falling blocks over the keys.
    const [format, setFormat] = useState<"staff" | "highway">("staff");
    const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
    const [quality, setQuality] = useState<keyof typeof SIZES>("720");
    const [fps, setFps] = useState<30 | 60>(30);
    const [showScore, setShowScore] = useState(true);
    const [showKeyboard, setShowKeyboard] = useState(true);
    const [showTitle, setShowTitle] = useState(true);
    const [showWordmark, setShowWordmark] = useState(true);
    // Treadmill: the score as one horizontal line scrolling under a fixed gaze
    // — the densest layout, made for the vertical feeds.
    const [treadmill, setTreadmill] = useState(true);
    // How the highway looks. Taste rather than meaning — the person making the video is
    // the one who knows what it is for — so both are offered rather than fixed.
    const [noteColor, setNoteColor] = useState(DEFAULT_NOTE_COLOR);
    const [keyboardDepth, setKeyboardDepth] = useState(DEFAULT_KEYBOARD_DEPTH);

    useEffect(() => {
        let cancelled = false;
        exporter.supported().then((ok) => {
            if (!cancelled) {
                setSupported(ok);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [exporter]);

    if (!supported) {
        return null;
    }

    const save = async () => {
        setProgress(0);
        try {
            const base = SIZES[quality];
            const width = orientation === "portrait" ? base.height : base.width;
            const height = orientation === "portrait" ? base.width : base.height;
            // Colouring by finger needs a finger on every note. A take carries none — it
            // is somebody playing, not a score — so the cost model is asked for one,
            // which is also what decides the hands.
            const notes =
                format === "highway" && noteColor === BY_FINGER
                    ? fingeredFreely(take.composition.notes)
                    : take.composition.notes;
            const durationMs = videoDurationMs(notes);
            const keyColors = { white: theme.whiteHex, black: theme.blackHex };
            // The take's own notation, rendered off-screen and rasterized once, so
            // the video shows the sheet music with each note tinted as it sounds.
            // A take the renderer can't draw exports keyboard-only instead. The
            // highway format never uses the staff.
            const score =
                format === "staff" && showScore
                    ? await buildScoreSnapshot(take, original, treadmill)
                    : null;
            const paint =
                format === "highway"
                    ? takeHighwayPainter({
                          title,
                          credit,
                          notes,
                          durationMs,
                          width,
                          height,
                          showTitle,
                          showWordmark,
                          keyColors,
                          accent: noteColorHex(noteColor),
                          byFinger: noteColor === BY_FINGER,
                          keyboardDepth: keyboardDepthFraction(keyboardDepth),
                      })
                    : takeScenePainter({
                          title,
                          credit,
                          notes,
                          durationMs,
                          width,
                          height,
                          score,
                          keyboard: showKeyboard,
                          treadmill,
                          showTitle,
                          showWordmark,
                          keyColors,
                      });
            const blob = await exporter.export(
                { width, height, fps, durationMs, paint, notes },
                setProgress,
            );
            downloadBlob(blob, "video/mp4", `${takeFileStem(title, take)}.mp4`);
        } finally {
            setProgress(null);
        }
    };

    return (
        // The whole video flow lives behind one disclosure, so a take's row keeps
        // its one-tap exports flat and the multi-option video panel opens as a
        // clearly grouped card below.
        <Disclosure summary={m.video_export()}>
            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line p-2">
                <SegmentedControl
                    options={[
                        { id: "staff", label: m.video_format_staff() },
                        { id: "highway", label: m.highway_toggle() },
                    ]}
                    value={format}
                    onChange={(id) => setFormat(id as "staff" | "highway")}
                    label={m.video_style()}
                />
                <SegmentedControl
                    options={[
                        { id: "landscape", label: "16:9" },
                        { id: "portrait", label: "9:16" },
                    ]}
                    value={orientation}
                    onChange={setOrientation}
                    label={m.video_orientation()}
                />
                <SegmentedControl
                    options={[
                        { id: "720", label: "720p" },
                        { id: "1080", label: "1080p" },
                    ]}
                    value={quality}
                    onChange={(id) => setQuality(id as keyof typeof SIZES)}
                    label={m.video_quality()}
                />
                <SegmentedControl
                    options={[
                        { id: "30", label: "30" },
                        { id: "60", label: "60" },
                    ]}
                    value={String(fps)}
                    onChange={(id) => setFps(Number(id) as 30 | 60)}
                    label={m.video_fps()}
                />
                {/* Highway looks only: the staff format draws no falling notes, and its
                keyboard shares the stage with the notation rather than sitting on the
                floor of the frame. */}
                {format === "highway" && (
                    <>
                        <SegmentedControl
                            options={NOTE_COLORS.map((color) => ({
                                id: color.id,
                                label: (NOTE_COLOR_LABELS[color.id] ?? color.id.toString)(),
                            }))}
                            value={noteColor}
                            onChange={setNoteColor}
                            label={m.video_note_color()}
                        />
                        <SegmentedControl
                            options={KEYBOARD_DEPTHS.map((depth) => ({
                                id: depth.id,
                                label: (DEPTH_LABELS[depth.id] ?? depth.id.toString)(),
                            }))}
                            value={keyboardDepth}
                            onChange={setKeyboardDepth}
                            label={m.video_keyboard_depth()}
                        />
                    </>
                )}
                {/* Staff-format layers only — the highway is always blocks over the
                keyboard, so the score/treadmill/keyboard switches don't apply. */}
                {format === "staff" && (
                    <>
                        <Switch
                            checked={showScore}
                            onChange={setShowScore}
                            label={m.video_show_score()}
                        />
                        {showScore && (
                            <Switch
                                checked={treadmill}
                                onChange={setTreadmill}
                                label={m.treadmill_toggle()}
                            />
                        )}
                        {/* Landscape can drop either layer (never both — with the score
                        off the keyboard is all that's left); portrait is score-only by
                        design, so the keyboard switch only appears where it has an effect. */}
                        {orientation === "landscape" && showScore && (
                            <Switch
                                checked={showKeyboard}
                                onChange={setShowKeyboard}
                                label={m.video_show_keyboard()}
                            />
                        )}
                    </>
                )}
                <Switch checked={showTitle} onChange={setShowTitle} label={m.video_show_title()} />
                <Switch
                    checked={showWordmark}
                    onChange={setShowWordmark}
                    label={m.video_show_watermark()}
                />
                <Button
                    variant="ghost"
                    onClick={save}
                    disabled={progress !== null}
                    aria-label={
                        orientation === "portrait"
                            ? m.takes_download_video_portrait()
                            : m.takes_download_video()
                    }
                >
                    {progress === null
                        ? m.takes_download_video()
                        : m.takes_video_progress({ percent: Math.round(progress * 100) })}
                </Button>
            </div>
        </Disclosure>
    );
}
