// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { toMusicXml } from "../../core/composition";
import type { Hand } from "../../core/matcher";
import type { Take } from "../../core/takes";
import type { ScoreBox } from "../../core/videoScene";
import { collectNoteElements } from "./scoreColor";

// The pre-rendered score a take video draws: the notation rasterized once, plus
// where each step's noteheads sit on it, so the painter can slide a window along
// the music and tint the played notes frame by frame.
export type ScoreSnapshot = {
    image: ImageBitmap;
    width: number;
    height: number;
    // One entry per step (a chord is one step), in playing order — the same
    // order the take's distinct onsets follow.
    steps: ScoreBox[][];
};

// The piece's real notation, when the exporting page knows it — so the video
// shows the score a viewer would recognize, not a re-engraving of the playing.
export type OriginalScore = { xml: string; hand: Hand };

// Render the notation off-screen (the print button's idiom: an owned OSMD
// instance, never the ScoreViewer's) and rasterize it. Preferred source: the
// piece's own MusicXML, whose steps the take's onsets tint one for one — the
// matcher cleared them in exactly that order. When the take doesn't line up
// (played beyond the score's steps: another piece, another hand), or when no
// original is known (compose takes), the take's own composition renders
// instead. Returns null when everything fails: the video exports keyboard-only,
// never broken.
export async function buildScoreSnapshot(
    take: Take,
    original: OriginalScore | null = null,
): Promise<ScoreSnapshot | null> {
    if (original) {
        const snapshot = await snapshotFromXml(original.xml, original.hand);
        const takeSteps = new Set(take.composition.notes.map((note) => note.startMs)).size;
        if (snapshot && takeSteps <= snapshot.steps.length) {
            return snapshot;
        }
    }
    return snapshotFromXml(toMusicXml(take.composition), "both");
}

async function snapshotFromXml(xml: string, hand: Hand): Promise<ScoreSnapshot | null> {
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-99999px";
    host.style.top = "0";
    // Rendered wide, then drawn scaled down into the frame — that downscale is
    // what keeps the glyphs crisp in the 1280-wide video.
    host.style.width = "1600px";
    document.body.appendChild(host);
    try {
        // OSMD is heavy and browser-only; load it only on the export click.
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        const osmd = new OpenSheetMusicDisplay(host, {
            autoResize: false,
            drawingParameters: "compact",
        });
        await osmd.load(xml);
        osmd.render();
        const svg = host.querySelector("svg");
        if (!svg) {
            return null;
        }
        const svgRect = svg.getBoundingClientRect();
        if (svgRect.width === 0 || svgRect.height === 0) {
            return null;
        }
        // Box positions relative to the SVG's own top-left, in the same pixels
        // the rasterization below uses.
        const steps = collectNoteElements(osmd, hand).map((group) =>
            group.map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    x: rect.left - svgRect.left,
                    y: rect.top - svgRect.top,
                    width: rect.width,
                    height: rect.height,
                };
            }),
        );
        const image = await rasterizeSvg(svg, svgRect.width, svgRect.height);
        return image ? { image, width: svgRect.width, height: svgRect.height, steps } : null;
    } catch {
        return null;
    } finally {
        host.remove();
    }
}

// SVG markup → ImageBitmap via a blob-URL <img>. The width/height attributes are
// forced to the client size so the raster matches the measured box coordinates.
async function rasterizeSvg(
    svg: SVGElement,
    width: number,
    height: number,
): Promise<ImageBitmap | null> {
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    // outerHTML uses the HTML serializer, which leaves the SVG namespace implied
    // — but the blob below is parsed as standalone XML, where it must be spelled
    // out. Declaring it on the clone keeps this module off the XML codec seam
    // (that port is for MusicXML documents, not SVG serialization).
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([clone.outerHTML], {
        type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("svg raster failed"));
            img.src = url;
        });
        return await createImageBitmap(img);
    } catch {
        return null;
    } finally {
        URL.revokeObjectURL(url);
    }
}
