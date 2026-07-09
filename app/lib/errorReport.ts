// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { isRouteErrorResponse } from "react-router";

// Turns whatever the router hands the error boundary — a route error response,
// a thrown Error, or any other value — into what the error page shows and what
// the prefilled GitHub issue carries. Pure: page and browser identity arrive as
// parameters, so every shape is unit-testable without a window.

export type ErrorReport = {
    // A missing page gets a gentler message and no reload button.
    notFound: boolean;
    // The developer-facing detail shown under "Technical details" and in the issue.
    technical: string;
};

export function describeError(error: unknown): ErrorReport {
    const notFound = isRouteErrorResponse(error) && error.status === 404;
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
