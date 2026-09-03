// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AudioExport, AudioExporter } from "../ports/audioExporter";
import type { RecordedNote } from "../../core/composition";

// The composition root's audio-file capability, pulled in on first use.
//
// The same shape as the video shell and for the same reason: the muxer and the offline
// render are a large dependency, saving a file is a rare and deliberate act, and the
// bundle is a cost every visitor pays whether or not they ever export anything.
export const lazyAudioExporter: AudioExporter = {
    async export(notes: RecordedNote[]): Promise<AudioExport> {
        const { webAudioFileExporter } = await import("./webAudioFile");
        return webAudioFileExporter.export(notes);
    },
};
