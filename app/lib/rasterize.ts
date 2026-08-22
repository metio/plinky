// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Turns a self-contained SVG document into a PNG.
//
// Self-contained is the requirement, not a nicety: an SVG that reaches for a stylesheet
// or a font file taints the canvas, and a tainted canvas cannot be read back out — the
// export fails at the last step, after everything looked fine. The pictures this draws
// bake their own colours for exactly that reason.
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob | null> {
    const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
        return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    } finally {
        URL.revokeObjectURL(source);
    }
}
