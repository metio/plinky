// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { PlaySessionProvider, type PlaySessionProps } from "./playSession";
import { PlaySurface } from "./playSurface";

// Renders a MusicXML score with OpenSheetMusicDisplay and everything you do with it —
// Listen, self-paced Practice, tempo-locked play-along, the ghost race, the loop and the
// settings. The provider runs the session (the OSMD render surface, the transports, the
// effects that coordinate them) and holds it as one source of truth; the surface reads
// that and reacts. OSMD needs a real DOM and is large, so it loads on the client only.
export function ScoreViewer(props: PlaySessionProps) {
    return (
        <PlaySessionProvider {...props}>
            <PlaySurface />
        </PlaySessionProvider>
    );
}
