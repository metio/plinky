// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The audio-file seam: a take, rendered and handed back as something a person can keep.
//
// Separate from the video seam rather than a mode of it, because the two answer different
// questions. A video export asks which scene to paint, at what size, at how many frames;
// an audio export asks none of that — it has only the performance. Folding it in would put
// a width and a painter on a call that has no picture.
//
// It carries no supported(): unlike video, an audio file can always be produced. Where the
// engine has an encoder the file is compressed, and where it has none the samples are
// written as they are. So the seam reports which format came back rather than whether one
// could.

import type { RecordedNote } from "../../core/composition";

export type AudioExport = {
    blob: Blob;
    // The extension the blob should be saved under, without a dot — "m4a" or "wav". Chosen
    // by the adapter, since only it knows which encoder the engine actually had.
    extension: string;
};

export interface AudioExporter {
    // Render the performance and encode it. The best format this engine can produce, which
    // is never nothing.
    export(notes: RecordedNote[]): Promise<AudioExport>;
}
