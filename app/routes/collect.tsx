// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useId, useMemo, useState } from "react";
import { useStore } from "../contexts/services";
import { useKnownPieces } from "../hooks/useKnownPieces";
import { loadCatalog } from "../lib/catalog";
import { slugifyName } from "../../core/assignment";
import {
    type AssignmentReport,
    collectReports,
    groupReports,
    type ReportGroup,
    reportLetter,
    reportsToCsv,
    reportSummary,
} from "../../core/assignmentReport";
import { noindexMeta, routeMeta } from "../../core/site";
import { Button } from "../components/ui/button";
import { downloadBlob } from "../lib/download";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/collect";
import { PageHeader } from "../components/ui/pageHeader";

export function meta(_args: Route.MetaArgs) {
    // A teacher's working surface over codes they were sent — nothing to index.
    return [...routeMeta(m.collect_title(), m.collect_intro()), noindexMeta()];
}

// Naming a piece from its id. A teacher's device holds its own library, which may
// not be the student's — an id it cannot resolve shows as itself rather than as a
// blank column nobody can identify.
function usePieceTitles(): (id: string) => string {
    const store = useStore();
    // Every piece this device can name. The catalogue's songs and exercises arrive with
    // the manifests — a teacher builds an assignment from the catalogue, so resolving
    // from the local library alone labelled every column with the piece's hash — and
    // the local library names the rest at once, before and without any network.
    const known = useKnownPieces();
    // One pass over the local library, not one per lookup: this is called once per
    // column while the page re-renders on every keystroke in the paste box.
    const local = useMemo(
        () => new Map(loadCatalog(store).map((score) => [score.id, score.title])),
        [store],
    );
    return useCallback((id: string) => known.titleOf(id) ?? local.get(id) ?? id, [known, local]);
}

// The other end of a handed-back assignment: paste in whatever arrived and read it
// as a class list. Nothing is stored — this page is a lens over the text in the
// box, so closing it leaves no record of anyone's students on the device.
export default function CollectRoute() {
    const [text, setText] = useState("");
    const groups = useMemo(() => groupReports(collectReports(text)), [text]);
    const titleOf = usePieceTitles();
    const found = groups.reduce((count, group) => count + group.reports.length, 0);

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.collect_title()} hint={m.collect_intro()} />

            <label className="block space-y-1">
                <span className="text-sm font-medium text-body">{m.collect_paste()}</span>
                <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={5}
                    className="w-full rounded-lg border border-line-strong p-2 font-mono text-xs dark:bg-raised"
                />
            </label>

            {text.trim().length > 0 && found === 0 && (
                <p role="status" className="text-sm text-muted">
                    {m.collect_nothing()}
                </p>
            )}

            {found > 0 && (
                <>
                    <p className="text-sm text-muted">{m.collect_found({ count: found })}</p>
                    {groups.map((group) => (
                        <GroupTable key={group.assignmentId} group={group} titleOf={titleOf} />
                    ))}
                    <p className="text-xs text-muted">{m.report_not_proof()}</p>
                </>
            )}
        </main>
    );
}

// One assignment's table. Each set gets its own columns: a piece nobody in this
// group was asked to play is not a column they all left blank.
function GroupTable({ group, titleOf }: { group: ReportGroup; titleOf: (id: string) => string }) {
    const name = group.assignmentName || m.collect_untitled();
    // Several tables share the page, so each is named by its own heading. Announced
    // as "table" and nothing else, they would be indistinguishable from one another.
    const headingId = useId();
    const download = () =>
        downloadBlob(reportsToCsv(group.reports, titleOf), "text/csv", `${slugifyName(name)}.csv`);
    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                <h2 id={headingId} className="font-medium text-body">
                    {name}
                </h2>
                <Button variant="secondary" onClick={download} aria-describedby={headingId}>
                    {m.collect_csv()}
                </Button>
            </div>
            <div className="overflow-x-auto">
                <table
                    aria-labelledby={headingId}
                    className="w-full min-w-max border-collapse text-sm"
                >
                    <thead>
                        <tr className="border-b border-line text-left">
                            <th scope="col" className="p-2">
                                {m.collect_who()}
                            </th>
                            <th scope="col" className="p-2">
                                {m.collect_played()}
                            </th>
                            {group.columns.map((id) => (
                                <th key={id} scope="col" className="p-2">
                                    {titleOf(id)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {group.reports.map((report) => (
                            <Row
                                key={`${report.assignmentId}:${report.who}`}
                                report={report}
                                columns={group.columns}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
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
            <td className="p-2 text-muted">{m.collect_of({ played, total })}</td>
            {columns.map((id) => {
                const score = scores.get(id);
                const letter = score === undefined ? null : reportLetter(score);
                return (
                    <td key={id} className="p-2">
                        {/* A piece nobody attempted reads as a blank, not an F. */}
                        {letter === null ? (
                            <span className="text-faint">–</span>
                        ) : (
                            `${letter} (${score})`
                        )}
                    </td>
                );
            })}
        </tr>
    );
}
