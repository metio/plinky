// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useMemo, useState } from "react";
import {
    type AssignmentReport,
    collectReports,
    reportLetter,
    reportsToCsv,
    reportSummary,
} from "../../core/assignmentReport";
import { noindexMeta, routeMeta } from "../../core/site";
import { Button } from "../components/ui/button";
import { useStore } from "../contexts/services";
import { resolveScore } from "../lib/catalog";
import { downloadBlob } from "../lib/download";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/collect";

export function meta(_args: Route.MetaArgs) {
    // A teacher's working surface over codes they were sent — nothing to index.
    return [...routeMeta(m.collect_title(), m.collect_intro()), noindexMeta()];
}

// Naming a piece from its id. A teacher's device holds its own library, which may
// not be the student's — an id it cannot resolve shows as itself rather than as a
// blank column nobody can identify.
function usePieceTitles(): (id: string) => string {
    const store = useStore();
    return useCallback((id: string) => resolveScore(store, id)?.title ?? id, [store]);
}

// The other end of a handed-back assignment: paste in whatever arrived and read it
// as a class list. Nothing is stored — this page is a lens over the text in the
// box, so closing it leaves no record of anyone's students on the device.
export default function CollectRoute() {
    const [text, setText] = useState("");
    const reports = useMemo(() => collectReports(text), [text]);
    const titleOf = usePieceTitles();

    const columns = reports.reduce<string[]>(
        (widest, report) =>
            report.items.length > widest.length ? report.items.map((item) => item.id) : widest,
        [],
    );

    const download = () =>
        downloadBlob(reportsToCsv(reports, titleOf), "text/csv", "plinky-assignment.csv");

    return (
        <main className="mx-auto max-w-5xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold">{m.collect_title()}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.collect_intro()}</p>
            </header>

            <label className="block space-y-1">
                <span className="text-sm font-medium text-body">{m.collect_paste()}</span>
                <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={5}
                    className="w-full rounded-lg border border-line-strong p-2 font-mono text-xs dark:bg-gray-900"
                />
            </label>

            {text.trim().length > 0 && reports.length === 0 && (
                <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
                    {m.collect_nothing()}
                </p>
            )}

            {reports.length > 0 && (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {m.collect_found({ count: reports.length })}
                        </p>
                        <Button variant="secondary" onClick={download}>
                            {m.collect_csv()}
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-max border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line text-left">
                                    <th scope="col" className="p-2">
                                        {m.collect_who()}
                                    </th>
                                    <th scope="col" className="p-2">
                                        {m.collect_played()}
                                    </th>
                                    {columns.map((id) => (
                                        <th key={id} scope="col" className="p-2">
                                            {titleOf(id)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((report) => (
                                    <Row
                                        key={`${report.assignmentId}:${report.who}`}
                                        report={report}
                                        columns={columns}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-muted">{m.report_not_proof()}</p>
                </>
            )}
        </main>
    );
}

function Row({ report, columns }: { report: AssignmentReport; columns: string[] }) {
    const { played, total } = reportSummary(report);
    const scores = new Map(report.items.map((item) => [item.id, item.score]));
    return (
        <tr className="border-b border-line-faint">
            <th scope="row" className="p-2 text-left font-medium">
                {report.who || m.collect_unnamed()}
            </th>
            <td className="p-2 text-gray-600 dark:text-gray-400">
                {m.collect_of({ played, total })}
            </td>
            {columns.map((id) => {
                const score = scores.get(id);
                const letter = score === undefined ? null : reportLetter(score);
                return (
                    <td key={id} className="p-2">
                        {/* A piece nobody attempted reads as a blank, not an F. */}
                        {letter === null ? (
                            <span className="text-gray-400 dark:text-gray-600">–</span>
                        ) : (
                            `${letter} (${score})`
                        )}
                    </td>
                );
            })}
        </tr>
    );
}
