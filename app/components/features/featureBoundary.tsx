// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, type ErrorInfo, type ReactNode } from "react";
import { describeError, issueUrl, REPO_ISSUES } from "../../lib/errorReport";
import { m } from "../../paraglide/messages.js";
import { buttonClasses } from "../ui/button";

// Keeps one broken panel from taking the page with it.
//
// The router's error boundary is the whole document's: anything it catches replaces
// every pane on screen, so a stumble in one self-contained panel — a stats card, a
// news banner, a notation example — costs the reader the page they were using and all
// the parts of it that were working. The home and You pages are built from panels that
// each read their own store and know nothing of their neighbours, which is exactly the
// shape a boundary per panel fits.
//
// A quieter failure must not be an invisible one: the panel keeps the report link the
// full-page error carries, so a crash that no longer interrupts the reader can still be
// sent somewhere. There is no server to notice it for us.

type Props = {
    children: ReactNode;
    // Where the panel sat, for the issue title — so a report names the panel rather
    // than only its error. Never shown to the reader.
    feature: string;
};

type State = { error: unknown | null };

export class FeatureBoundary extends Component<Props, State> {
    override state: State = { error: null };

    static getDerivedStateFromError(error: unknown): State {
        return { error };
    }

    // React logs the error and this stack itself; keeping the hook explicit documents
    // that the omission of our own logging is deliberate rather than forgotten.
    override componentDidCatch(_error: unknown, _info: ErrorInfo) {}

    private retry = () => {
        this.setState({ error: null });
    };

    override render() {
        if (this.state.error === null) {
            return this.props.children;
        }
        return (
            <FeatureFallback
                error={this.state.error}
                feature={this.props.feature}
                onRetry={this.retry}
            />
        );
    }
}

// The panel-sized version of the error page: what happened, that the rest is fine, and
// the two things worth offering — try it again, or tell us.
function FeatureFallback({
    error,
    feature,
    onRetry,
}: {
    error: unknown;
    feature: string;
    onRetry: () => void;
}) {
    const report = describeError(error);
    // A retry that re-renders the same broken input throws again straight away, which
    // is the honest outcome — but it is worth offering, because a panel that failed on
    // a transient read (a store that was momentarily unavailable) recovers on a press.
    const where = typeof window === "undefined" ? "" : window.location.href;
    const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;

    return (
        <section className="space-y-3 rounded-md border border-line p-4">
            <p className="text-sm text-muted">{m.feature_broken()}</p>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onRetry} className={buttonClasses("secondary")}>
                    {m.action_try_again()}
                </button>
                <a
                    href={issueUrl(
                        REPO_ISSUES,
                        { ...report, technical: `${feature}: ${report.technical}` },
                        where,
                        agent,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClasses("ghost")}
                >
                    {m.action_report_problem()}
                </a>
            </div>
        </section>
    );
}
