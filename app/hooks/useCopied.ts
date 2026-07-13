// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";
import { useScheduler } from "../contexts/services";

// A brief "copied!" confirmation: `flash(key)` marks which copy button just landed
// its clipboard write, and the mark reverts on its own after a moment. The key lets
// a page with several copy buttons show the confirmation on the one that was
// pressed; a page with a single button can call `flash()` and test truthiness. The
// revert timer is cleared on unmount, since the page can be navigated away within it.
export function useCopied(revertMs = 2000): [string | null, (key?: string) => void] {
    const scheduler = useScheduler();
    const [copied, setCopied] = useState<string | null>(null);
    const timer = useRef(0);
    useEffect(() => () => scheduler.cancel(timer.current), [scheduler]);
    const flash = useCallback(
        (key = "copied") => {
            setCopied(key);
            scheduler.cancel(timer.current);
            timer.current = scheduler.after(revertMs, () => setCopied(null));
        },
        [revertMs, scheduler],
    );
    return [copied, flash];
}
