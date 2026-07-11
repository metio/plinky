// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import type { Take } from "../../../core/takes";
import { videoDurationMs } from "../../../core/videoFrames";
import { useVideoExporter } from "../../contexts/services";
import { downloadBlob } from "../../lib/download";
import { buildScoreSnapshot } from "../../lib/scoreSnapshot";
import { takeScenePainter } from "../../lib/videoPainter";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";

// 720p at 30fps: crisp enough for any feed, small enough to render in seconds.
// Portrait swaps the axes for the 9:16 feeds (Reels, Shorts, TikTok).
const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;

// Renders a saved take as an MP4 — the keyboard playing itself with the
// piece's title and credit burnt in — and downloads it. Only offered where the
// engine can actually encode one (the exporter is asked, not sniffed); while
// rendering, the label counts progress so a long take visibly works.
export function ExportVideoButton({
    take,
    title,
    credit,
}: {
    take: Take;
    title: string;
    credit: string;
}) {
    const exporter = useVideoExporter();
    const [supported, setSupported] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);

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

    const save = async (width: number, height: number) => {
        setProgress(0);
        try {
            const notes = take.composition.notes;
            const durationMs = videoDurationMs(notes);
            // The take's own notation, rendered off-screen and rasterized once, so
            // the video shows the sheet music with each note tinted as it sounds.
            // A take the renderer can't draw exports keyboard-only instead.
            const score = await buildScoreSnapshot(take);
            const blob = await exporter.export(
                {
                    width,
                    height,
                    fps: FPS,
                    durationMs,
                    paint: takeScenePainter({
                        title,
                        credit,
                        notes,
                        durationMs,
                        width,
                        height,
                        score,
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
        <>
            <Button
                variant="ghost"
                onClick={() => save(WIDTH, HEIGHT)}
                disabled={progress !== null}
            >
                {progress === null
                    ? m.takes_download_video()
                    : m.takes_video_progress({ percent: Math.round(progress * 100) })}
            </Button>
            <Button
                variant="ghost"
                onClick={() => save(HEIGHT, WIDTH)}
                disabled={progress !== null}
                aria-label={m.takes_download_video_portrait()}
            >
                9:16
            </Button>
        </>
    );
}
