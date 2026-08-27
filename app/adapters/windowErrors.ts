// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ErrorFeed } from "../ports/errorFeed";

// The window's two unhandled-fault events behind the ErrorFeed port.
//
// `error` fires for a throw that reached the top — an event handler, a timer, a script
// that failed to parse. `unhandledrejection` fires for a promise nobody caught, which is
// the likelier shape here: most of what this app does off the render path is a fetch, a
// decode or an audio graph, and all of them are promises.
//
// Neither event is prevented. Letting them through keeps the console message a developer
// expects, and the browser's own reporting, exactly as they were.
export const windowErrors: ErrorFeed = {
    subscribe(onFault) {
        if (typeof window === "undefined") {
            return () => {};
        }
        const where = () => window.location.pathname;

        const onError = (event: ErrorEvent) => {
            // `message` is the browser's own summary; `error.stack` says where. A
            // cross-origin script gives neither and yields "Script error." — recorded
            // anyway, since knowing something failed is worth more than nothing.
            const stack = event.error instanceof Error ? event.error.stack : null;
            onFault({ message: stack ?? event.message ?? "unknown error", where: where() });
        };

        const onRejection = (event: PromiseRejectionEvent) => {
            const reason: unknown = event.reason;
            const message =
                reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
            onFault({ message: `Unhandled rejection: ${message}`, where: where() });
        };

        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onRejection);
        return () => {
            window.removeEventListener("error", onError);
            window.removeEventListener("unhandledrejection", onRejection);
        };
    },
};
