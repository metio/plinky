// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { type DiagramKey, svgKeyboardDiagram } from "../../../core/keyboardDiagram";
import { downloadBlob } from "../../lib/download";
import { m } from "../../paraglide/messages.js";
import { svgToPng } from "../../lib/rasterize";
import { Button } from "../ui/button";

// Takes a drawing away as a file.
//
// What a teacher hands a pupil is a picture of where the fingers go, and what a pupil
// loses between lessons is exactly that. The app can already show it; this is the half
// that lets it leave — into a lesson plan, a printout, a message.
//
// Two formats, because they are for two different destinations. A picture goes into a
// message, and a message wants a PNG. A worksheet goes onto paper, and paper wants the
// drawing itself: the SVG prints at whatever size the page is, where a rasterised copy
// prints at whatever size it was rasterised. The SVG is also the cheaper path — it is
// the string the diagram already is, with no canvas in the way.
//
// The caller passes a thunk rather than the markup, so a drawing nobody saves is never
// built.
export function SaveDiagram({
    svg,
    filename,
    pictureLabel = m.tools_save_picture(),
}: {
    svg: () => string;
    filename: string;
    pictureLabel?: string;
}) {
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);

    const guard = async (save: () => Promise<void> | void) => {
        setSaving(true);
        setFailed(false);
        try {
            await save();
        } catch {
            // A browser that will not decode the document, or will not give up a canvas,
            // fails here. Saying nothing is the worst of the options: the reader presses
            // a button, no file arrives, and nothing on the page admits it. An error
            // boundary cannot help, because a throw inside an async handler never
            // reaches one.
            setFailed(true);
        } finally {
            setSaving(false);
        }
    };

    const savePng = () =>
        guard(async () => {
            const markup = svg();
            // The document says how big it is; rasterising at its own size keeps the
            // strokes crisp rather than resampling them.
            const width = Number(/width="(\d+)"/.exec(markup)?.[1] ?? 1200);
            const height = Number(/height="(\d+)"/.exec(markup)?.[1] ?? 460);
            const png = await svgToPng(markup, width, height);
            if (png === null) {
                setFailed(true);
                return;
            }
            downloadBlob(png, "image/png", `${filename}.png`);
        });

    const saveSvg = () =>
        guard(() => {
            downloadBlob(svg(), "image/svg+xml", `${filename}.svg`);
        });

    return (
        <div className="space-y-1">
            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={savePng} disabled={saving}>
                    {pictureLabel}
                </Button>
                <Button variant="secondary" onClick={saveSvg} disabled={saving}>
                    {m.tools_save_svg()}
                </Button>
            </div>
            {failed && (
                <p role="status" className="text-sm text-danger">
                    {m.feature_broken()}
                </p>
            )}
        </div>
    );
}

// One keyboard, marked. The picture is the app's own keyboard geometry, so it is the
// instrument the reader already reads rather than a second drawing that lines up
// differently.
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
    return (
        <SaveDiagram
            svg={() => svgKeyboardDiagram({ from, to, keys, caption, noteNames: true })}
            filename={filename}
        />
    );
}
