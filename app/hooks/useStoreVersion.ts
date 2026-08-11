// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useRef, useSyncExternalStore } from "react";

// Re-render whenever a store announces a change, for a component that reads several
// entries out of a keyed store rather than one value out of a single-value one.
//
// The usual `useSyncExternalStore(subscribe, load)` needs a snapshot that changes
// when the data does. A keyed store has no single such value: deriving one (an entry
// count, a concatenated key list) misses exactly the case where an existing entry's
// contents changed, and React then bails out of the render because the snapshot
// compared equal. A counter bumped on every announcement always differs, so the
// component re-reads whatever entries it cares about.
export function useStoreVersion(subscribe: (onChange: () => void) => () => void): number {
    const version = useRef(0);
    return useSyncExternalStore(
        useCallback(
            (onChange: () => void) =>
                subscribe(() => {
                    version.current += 1;
                    onChange();
                }),
            [subscribe],
        ),
        () => version.current,
        () => 0,
    );
}
