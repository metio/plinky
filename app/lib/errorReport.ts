// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isRouteErrorResponse } from "react-router";

// Turns whatever the router hands the error boundary — a route error response,
// a thrown Error, or any other value — into what the error page shows and what
// the prefilled GitHub issue carries. Pure: page and browser identity arrive as
// parameters, so every shape is unit-testable without a window.

// Where a bug report goes. Both the full-page error and a single broken panel link
// here, so the destination is stated once.
export const REPO_ISSUES = "https://github.com/metio/plinky/issues/new";

// A page that does not exist, raised from a component rather than from a loader.
//
// The router builds its own 404 when nothing matches, but the catch-all route matches
// everything by design — so when it decides an address is a genuine miss it has to say so
// itself. A Response thrown during render is not turned into a route error response the
// way one thrown from a loader is, which is why this is its own class rather than a 404
// Response: the error boundary would otherwise call a missing page a crash.
export class NotFoundError extends Error {
    constructor(pathname: string) {
        super(`404 Not Found: ${pathname}`);
        this.name = "NotFoundError";
    }
}

export type ErrorReport = {
    // A missing page gets a gentler message and no reload button.
    notFound: boolean;
    // The developer-facing detail shown under "Technical details" and in the issue.
    technical: string;
};

export function describeError(error: unknown): ErrorReport {
    const notFound =
        (isRouteErrorResponse(error) && error.status === 404) || error instanceof NotFoundError;
    let technical: string;
    if (isRouteErrorResponse(error)) {
        technical = `${error.status} ${error.statusText}`;
    } else if (error instanceof Error) {
        technical = `${error.message}\n\n${error.stack ?? ""}`.trim();
    } else {
        technical = String(error);
    }
    return { notFound, technical };
}

// The prefilled new-issue URL: a title from the error's first line and a body
// that asks the reporter only for what we cannot capture — what they were doing.
export function issueUrl(
    issuesBase: string,
    report: ErrorReport,
    page: string,
    userAgent: string,
): string {
    const body = [
        "**What were you doing when this happened?**",
        "",
        "_(please describe)_",
        "",
        `**Page:** ${page}`,
        "",
        "**Details**",
        "",
        "```",
        report.technical,
        "```",
        "",
        `**Browser:** ${userAgent}`,
    ].join("\n");
    const title = report.notFound ? "Page not found" : `Error: ${report.technical.split("\n")[0]}`;
    return `${issuesBase}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
