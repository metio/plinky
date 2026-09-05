// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type DependencyList, useEffect } from "react";

// An effect whose work finishes later than the render that started it — a manifest
// fetched, an engraver imported, a permission asked — and must not write into a
// component that has moved on. `alive()` says whether this run of the effect is still the
// current one: false once the dependencies changed or the component unmounted. Every
// setter after an await goes behind it, and the guard is the only way to write the
// effect rather than a flag each copy had to remember.
//
// A returned function is the effect's own cleanup, run after the run is marked dead.
export function useAsyncEffect(
    effect: (alive: () => boolean) => undefined | (() => void),
    deps: DependencyList,
): void {
    useEffect(() => {
        let live = true;
        const cleanup = effect(() => live);
        return () => {
            live = false;
            cleanup?.();
        };
        // biome-ignore lint/correctness/useExhaustiveDependencies: the dependencies are the caller's, checked at the call as useEffect's are
    }, deps);
}
