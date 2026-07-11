// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { toMusicXml } from "../../core/composition";
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

// Render the take's own notation off-screen (the print button's idiom: an owned
// OSMD instance, never the ScoreViewer's) and rasterize it. The score comes from
// the take's composition, so the video shows exactly what was played — chords,
// held lengths and all. Returns null when anything fails: a take a browser can't
// render simply exports without notation, never a broken video.
export async function buildScoreSnapshot(take: Take): Promise<ScoreSnapshot | null> {
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
        await osmd.load(toMusicXml(take.composition));
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
        const steps = collectNoteElements(osmd, "both").map((group) =>
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
    // outerHTML serializes an SVG element to valid standalone markup in every
    // browser we run in (the print path relies on the same), keeping this module
    // off the XML codec, which is a document parser seam, not an SVG one.
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
