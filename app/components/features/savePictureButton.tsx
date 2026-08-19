// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { type DiagramKey, svgKeyboardDiagram } from "../../../core/keyboardDiagram";
import { downloadBlob } from "../../lib/download";
import { svgToPng } from "../../lib/rasterize";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";

// Takes the keyboard away as a picture.
//
// What a teacher hands a pupil is a drawing of where the fingers go, and what a pupil
// loses between lessons is exactly that. The app can already show it; this is the half
// that lets it leave — into a lesson plan, a printout, a message. The picture is the
// app's own keyboard geometry, so it is the instrument they already read rather than a
// second drawing that lines up differently.
export function SavePictureButton({
    from,
    to,
    keys,
    caption,
    filename,
}: {
    from: number;
    to: number;
    keys: readonly DiagramKey[];
    caption: string;
    filename: string;
}) {
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        try {
            const svg = svgKeyboardDiagram({ from, to, keys, caption, noteNames: true });
            // The document says how big it is; rasterising at its own size keeps the
            // strokes crisp rather than resampling them.
            const width = Number(/width="(\d+)"/.exec(svg)?.[1] ?? 1200);
            const height = Number(/height="(\d+)"/.exec(svg)?.[1] ?? 460);
            const png = await svgToPng(svg, width, height);
            if (png) {
                downloadBlob(png, "image/png", filename);
            }
        } finally {
            setSaving(false);
        }
    };
    return (
        <Button variant="secondary" onClick={save} disabled={saving}>
            {m.tools_save_picture()}
        </Button>
    );
}
