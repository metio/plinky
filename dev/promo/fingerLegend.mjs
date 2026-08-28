// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The finger-to-colour table both a clip's description and a playlist's carry. One copy,
// because the mapping is fixed forever and two lists of it would be one too many.

import { FINGER_COLORS } from "../../core/videoLook.ts";

// Thumb to little finger, in the order core/videoLook fixes them. The names are the
// colours a viewer would say out loud, not the hexes — nobody reads #ff9f45 off a screen.
const FINGER_NAMES = ["thumb", "index finger", "middle finger", "ring finger", "little finger"];
const COLOR_NAMES = ["red", "orange", "yellow", "pink", "violet"];
// Walked over the palette itself, so the legend can only ever describe as many fingers as
// there are colours. A palette that grew a sixth entry with no name for it would say so
// here rather than silently describing five of six.
export const FINGER_LEGEND = FINGER_COLORS.map((_, i) => {
    const finger = FINGER_NAMES[i];
    const color = COLOR_NAMES[i];
    if (!finger || !color) {
        throw new Error(`no name for finger ${i + 1}; core/videoLook has more colours than this`);
    }
    return `${i + 1}. ${finger} — ${color}`;
});
