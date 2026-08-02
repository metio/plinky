// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import type { Assignment } from "../../../core/assignment";
import { buildReport, encodeReport, MAX_WHO_LENGTH } from "../../../core/assignmentReport";
import { useCopied } from "../../hooks/useCopied";
import { useMasteryStore } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { Disclosure } from "../ui/disclosure";

// Handing an assignment back to whoever set it. The student types a name, and the
// device turns what it knows about the list into one code to paste into a message.
//
// The copy is careful not to call this proof. The code is written by the same
// device it describes, so it replaces the transcription, not the trust — a
// practice log that happens to be accurate, which is what a teacher was relying on
// before anyway.
export function ReportBack({ assignment }: { assignment: Assignment }) {
    const mastery = useMasteryStore();
    const [who, setWho] = useState("");
    const [code, setCode] = useState<string | null>(null);
    const [copied, flashCopied] = useCopied();

    const make = () => {
        const report = buildReport(
            assignment,
            (id) => mastery.load(id)?.bestScore ?? null,
            who,
            Date.now(),
        );
        setCode(encodeReport(report));
    };

    const copy = async () => {
        if (!code) {
            return;
        }
        try {
            await navigator.clipboard?.writeText(code);
            flashCopied("report");
        } catch {
            // A blocked clipboard leaves the code on screen to select by hand.
        }
    };

    return (
        <Disclosure summary={m.report_back()}>
            <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.report_back_hint()}</p>
                <label className="block space-y-1">
                    <span className="text-sm font-medium text-body">{m.report_who()}</span>
                    <input
                        type="text"
                        value={who}
                        maxLength={MAX_WHO_LENGTH}
                        onChange={(event) => {
                            setWho(event.target.value);
                            // The code describes a name; changing it must not leave an
                            // older one on screen looking current.
                            setCode(null);
                        }}
                        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm dark:bg-gray-900"
                    />
                </label>
                <Button variant="secondary" onClick={make} disabled={who.trim().length === 0}>
                    {m.report_make()}
                </Button>
                {code && (
                    <div className="space-y-2">
                        <textarea
                            readOnly
                            value={code}
                            rows={3}
                            aria-label={m.report_code()}
                            className="w-full break-all rounded-lg border border-line-strong p-2 font-mono text-xs dark:bg-gray-900"
                        />
                        <Button variant="secondary" onClick={copy}>
                            {copied === "report" ? m.share_copied() : m.report_copy()}
                        </Button>
                        <p className="text-xs text-muted">{m.report_not_proof()}</p>
                    </div>
                )}
            </div>
        </Disclosure>
    );
}
