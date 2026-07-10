// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useRef, useState } from "react";

// A brief "copied!" confirmation: `flash(key)` marks which copy button just landed
// its clipboard write, and the mark reverts on its own after a moment. The key lets
// a page with several copy buttons show the confirmation on the one that was
// pressed; a page with a single button can call `flash()` and test truthiness. The
// revert timer is cleared on unmount, since the page can be navigated away within it.
export function useCopied(revertMs = 2000): [string | null, (key?: string) => void] {
    const [copied, setCopied] = useState<string | null>(null);
    const timer = useRef(0);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const flash = useCallback(
        (key = "copied") => {
            setCopied(key);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setCopied(null), revertMs);
        },
        [revertMs],
    );
    return [copied, flash];
}
