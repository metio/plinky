// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import type { Take } from "../../../core/takes";
import { videoDurationMs } from "../../../core/videoFrames";
import { useVideoExporter } from "../../contexts/services";
import { downloadBlob } from "../../lib/download";
import { buildScoreSnapshot, type OriginalScore } from "../../lib/scoreSnapshot";
import { takeScenePainter } from "../../lib/videoPainter";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
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
    const [supported, setSupported] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
    const [quality, setQuality] = useState<keyof typeof SIZES>("720");
    const [fps, setFps] = useState<30 | 60>(30);
    const [showScore, setShowScore] = useState(true);
    const [showKeyboard, setShowKeyboard] = useState(true);

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
            const notes = take.composition.notes;
            const durationMs = videoDurationMs(notes);
            // The take's own notation, rendered off-screen and rasterized once, so
            // the video shows the sheet music with each note tinted as it sounds.
            // A take the renderer can't draw exports keyboard-only instead.
            const score = showScore ? await buildScoreSnapshot(take, original) : null;
            const blob = await exporter.export(
                {
                    width,
                    height,
                    fps,
                    durationMs,
                    paint: takeScenePainter({
                        title,
                        credit,
                        notes,
                        durationMs,
                        width,
                        height,
                        score,
                        keyboard: showKeyboard,
                    }),
                    notes,
                },
                setProgress,
            );
            downloadBlob(blob, "video/mp4", `${title}-take.mp4`);
        } finally {
            setProgress(null);
        }
    };

    return (
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
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
            <Switch checked={showScore} onChange={setShowScore} label={m.video_show_score()} />
            {/* Landscape can drop either layer (never both — with the score off the
                keyboard is all that's left); portrait is score-only by design, so
                the keyboard switch only appears where it has an effect. */}
            {orientation === "landscape" && showScore && (
                <Switch
                    checked={showKeyboard}
                    onChange={setShowKeyboard}
                    label={m.video_show_keyboard()}
                />
            )}
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
    );
}
