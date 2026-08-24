// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRef } from "react";

// A ref that always holds the latest value, for reading inside something that outlives the
// render it was created in.
//
// The problem it solves comes up everywhere in this app: a subscription, a timer or an event
// listener set up once, whose callback must see the CURRENT props rather than the ones from
// the render that installed it. Putting the value in a dependency array instead would tear
// the subscription down and build it again on every change — which for a MIDI listener, a
// score cursor or a running metronome is not a re-render, it is a dropped note.
//
// The assignment is during render on purpose, not in an effect. An effect runs after paint,
// so a callback firing between the render and the effect would read the previous value —
// rare, and exactly the kind of rare that shows up as a note played against the wrong tempo
// once in a hundred runs. Writing a ref during render is safe because nothing reads it
// during render: it is only ever read later, from a callback.
export function useLatest<T>(value: T) {
    const ref = useRef(value);
    ref.current = value;
    return ref;
}
