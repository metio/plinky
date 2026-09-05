// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { todayKey } from "../../../core/daily";
import { shiftDay, weekdayIndex } from "../../../core/dateKey";
import {
    heatLevel,
    MAX_LABEL_LENGTH,
    MAX_MANUAL_MINUTES,
    type Mood,
    MOODS,
    type PracticeDay,
    type PracticeReport as PracticeReportData,
    type PracticeSession,
    practiceLogToCsv,
    RANGE_DAYS,
    type RangeKey,
} from "../../../core/practiceSession";
import { usePracticeLogStore } from "../../contexts/services";
import { usePracticeLog, usePracticeReport } from "../../hooks/usePracticeLog";
import { practiceDuration as duration } from "../../lib/practiceDuration";
import { downloadBlob } from "../../lib/download";
import { printPage } from "../../lib/printPage";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { Disclosure } from "../ui/disclosure";
import { SegmentedControl } from "../ui/segmentedControl";
import { compactFieldClasses, sectionHeadingClasses } from "../ui/classes";
import { StatTile } from "../ui/statTile";

// The practice diary, rolled up. How long, on which days, and what it felt like —
// the retrospective a player keeps for themselves and the summary a teacher asks
// to see. Everything here reads from the log; nothing on this panel judges it.
// A quiet week is drawn as a quiet week, never as a lapse.

const RANGES: RangeKey[] = ["week", "month", "quarter", "year"];

const RANGE_LABEL: Record<RangeKey, () => string> = {
    week: () => m.practice_range_week(),
    month: () => m.practice_range_month(),
    quarter: () => m.practice_range_quarter(),
    year: () => m.practice_range_year(),
};

const MOOD_LABEL: Record<Mood, () => string> = {
    rough: () => m.practice_mood_rough(),
    slow: () => m.practice_mood_slow(),
    steady: () => m.practice_mood_steady(),
    good: () => m.practice_mood_good(),
    breakthrough: () => m.practice_mood_breakthrough(),
};

// The four filled steps plus the empty one, as the tokens that carry them. Indexed
// by heatLevel, so the scale is defined once and the grid cannot drift from it.
const HEAT_CLASS = [
    "bg-heat-none",
    "bg-heat-light",
    "bg-heat-mid",
    "bg-heat-strong",
    "bg-heat-deep",
] as const;

// A day per cell, weeks running left to right and weekdays top to bottom — the
// shape every practice calendar uses, so it reads without a legend. Leading blanks
// keep the first column on its real weekday, or a Wednesday start would shift every
// row and the weekday pattern a player is looking for would disappear.
function ConsistencyGrid({ days }: { days: PracticeDay[] }) {
    const busiest = Math.max(0, ...days.map((day) => day.activeMs));
    const first = days.at(0);
    // Monday first, as the week scope counts it: one reading of where a week starts.
    const leading = first ? weekdayIndex(first.date) : 0;
    // The days before the range began, only ever drawn as blanks. Keyed by the date
    // they stand for rather than by position, so a range change re-keys them instead
    // of reusing a cell that now means a different day.
    const padding = first
        ? Array.from({ length: leading }, (_, index) => shiftDay(first.date, index - leading))
        : [];
    return (
        <div className="overflow-x-auto">
            {/* auto-cols-max, or the columns stretch to fill the container and a month
                of practice spreads into four lonely stripes instead of a calendar. */}
            <div className="grid w-fit grid-flow-col grid-rows-7 auto-cols-max gap-1">
                {padding.map((date) => (
                    <div key={date} aria-hidden="true" className="size-3" />
                ))}
                {days.map((day) => (
                    <div
                        key={day.date}
                        className={`size-3 rounded-xs ${HEAT_CLASS[heatLevel(day.activeMs, busiest)]}`}
                        title={m.practice_day_tooltip({
                            date: day.date,
                            time: duration(day.activeMs),
                        })}
                    />
                ))}
            </div>
        </div>
    );
}

function MoodPicker({ session }: { session: PracticeSession }) {
    const store = usePracticeLogStore();
    return (
        <SegmentedControl
            label={m.practice_mood()}
            value={session.mood ?? "none"}
            onChange={(next) =>
                store.setMood(session.start, next === "none" ? null : (next as Mood))
            }
            options={[
                { id: "none", label: m.practice_mood_none() },
                ...MOODS.map((mood) => ({ id: mood, label: MOOD_LABEL[mood]() })),
            ]}
        />
    );
}

function SessionRow({
    session,
    pieceTitle,
}: {
    session: PracticeSession;
    pieceTitle: (id: string) => string;
}) {
    const store = usePracticeLogStore();
    return (
        <li className="space-y-2 rounded-lg border border-line bg-surface p-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium text-body">{duration(session.activeMs)}</span>
                <span className="text-sm text-muted">
                    {todayKey(new Date(session.start))}
                    {" · "}
                    {session.manual ? m.practice_session_by_hand() : m.practice_session_measured()}
                    {session.mood && ` · ${MOOD_LABEL[session.mood]()}`}
                </span>
                <Button
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => store.remove(session.start)}
                >
                    {m.practice_remove()}
                </Button>
            </div>
            {session.label !== "" && (
                <p className="text-sm whitespace-pre-line text-body">{session.label}</p>
            )}
            {session.pieces.length > 0 && (
                <p className="text-xs text-muted">{session.pieces.map(pieceTitle).join(" · ")}</p>
            )}
            {/* Folded away, and the chosen mood already reads in the line above. A row of
                five buttons per sitting would make the log louder than the practice it
                records, and nothing here is asking to be filled in. */}
            <Disclosure summary={m.practice_mood()}>
                <MoodPicker session={session} />
            </Disclosure>
        </li>
    );
}

// Time spent at a piano Plinky never heard. A practice diary that only counts what
// it measured undercounts every player who owns an acoustic instrument, and the
// report they hand a teacher would be wrong in the direction that matters.
function BackLogForm({ now }: { now: Date }) {
    const store = usePracticeLogStore();
    const [date, setDate] = useState(() => todayKey(now));
    const [minutes, setMinutes] = useState("30");
    const [label, setLabel] = useState("");

    const submit = () => {
        if (store.addManual({ date, minutes: Number(minutes), label })) {
            setLabel("");
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted">{m.practice_add_hint()}</p>
            <div className="flex flex-wrap gap-3">
                <label className="space-y-1 text-sm">
                    <span className="block font-medium text-body">{m.practice_add_date()}</span>
                    <input
                        type="date"
                        value={date}
                        max={todayKey(now)}
                        onChange={(event) => setDate(event.target.value)}
                        className={compactFieldClasses}
                    />
                </label>
                <label className="space-y-1 text-sm">
                    <span className="block font-medium text-body">{m.practice_add_minutes()}</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_MANUAL_MINUTES}
                        value={minutes}
                        onChange={(event) => setMinutes(event.target.value)}
                        className={`w-24 ${compactFieldClasses}`}
                    />
                </label>
            </div>
            <label className="block space-y-1 text-sm">
                <span className="block font-medium text-body">{m.practice_add_note()}</span>
                <input
                    type="text"
                    value={label}
                    maxLength={MAX_LABEL_LENGTH}
                    onChange={(event) => setLabel(event.target.value)}
                    className={`w-full ${compactFieldClasses}`}
                />
            </label>
            <Button onClick={submit}>{m.practice_add_action()}</Button>
        </div>
    );
}

function Totals({ report }: { report: PracticeReportData }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={m.practice_total_time()} value={duration(report.activeMs)} />
            <StatTile label={m.practice_days_practised()} value={report.activeDays} />
            <StatTile label={m.practice_typical_session()} value={duration(report.averageMs)} />
            <StatTile label={m.practice_notes_played()} value={report.notes} />
        </div>
    );
}

// How many recent sittings the list shows before it stops. The whole log is in the
// CSV; the panel is a summary, and an unbounded list would bury the totals it sits
// under on any device.
const LISTED_SESSIONS = 10;

export function PracticeReport({
    pieceTitle = (id) => id,
    now = new Date(),
    days,
    headed = true,
}: {
    // How many days to report on, counting today. Passed by the You page, whose scope dial
    // governs every figure on it — the report then draws no range control of its own,
    // because two controls for one question is the mess the page had.
    //
    // Left off (a story, a teacher's page), the report keeps its own control and its own
    // rolling ranges, so it still stands on its own anywhere else.
    days?: number;
    // Whether the panel draws its own heading. The Stats page heads each of its questions
    // once and gathers the answers beneath, so a panel answering one of them must not
    // restate its name — two headings for one thing is what made that page read as a stack
    // of sections rather than a set of answers. Everywhere else it still names itself.
    headed?: boolean;
    // Resolves a catalogue id to its title. Defaulted so a story or a test can mount
    // the panel without a catalogue, and injected rather than looked up here because
    // the panel has no business reading the library.
    pieceTitle?: (id: string) => string;
    // The day the report ends on. Defaulted to the wall clock and injected only by
    // stories and tests, which need a calendar that does not move.
    now?: Date;
}) {
    const [range, setRange] = useState<RangeKey>("month");
    const governed = days !== undefined;
    const log = usePracticeLog();
    const report = usePracticeReport(governed ? days : RANGE_DAYS[range], log, now);
    if (!log || !report) {
        return null;
    }

    const recent = [...log].reverse().slice(0, LISTED_SESSIONS);
    const download = () =>
        downloadBlob(
            practiceLogToCsv(log, pieceTitle, (at) =>
                new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
            ),
            "text/csv",
            "plinky-practice.csv",
        );

    return (
        <section className="space-y-4">
            <div className="space-y-1">
                {headed && (
                    <>
                        <h2 className={sectionHeadingClasses}>{m.practice_report_title()}</h2>
                        <p className="text-xs text-muted">{m.practice_report_intro()}</p>
                    </>
                )}
            </div>

            {!governed && (
                <SegmentedControl
                    label={m.practice_range_label()}
                    value={range}
                    onChange={setRange}
                    options={RANGES.map((id) => ({ id, label: RANGE_LABEL[id]() }))}
                />
            )}

            {report.sessions === 0 ? (
                <p className="text-sm text-muted">{m.practice_empty()}</p>
            ) : (
                <>
                    <Totals report={report} />
                    <div className="space-y-1">
                        <h3 className="text-sm font-medium text-body">
                            {m.practice_consistency()}
                        </h3>
                        <ConsistencyGrid days={report.days} />
                        {report.longestDay && (
                            <p className="text-xs text-muted">
                                {m.practice_longest_day({
                                    date: report.longestDay.date,
                                    time: duration(report.longestDay.activeMs),
                                })}
                            </p>
                        )}
                        {report.manualSessions > 0 && (
                            <p className="text-xs text-muted">
                                {m.practice_of_which_by_hand({ count: report.manualSessions })}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-body">{m.practice_sessions()}</h3>
                        <ul className="space-y-2">
                            {recent.map((session) => (
                                <SessionRow
                                    key={session.start}
                                    session={session}
                                    pieceTitle={pieceTitle}
                                />
                            ))}
                        </ul>
                    </div>
                </>
            )}

            <Disclosure summary={m.practice_add_title()}>
                <BackLogForm now={now} />
            </Disclosure>

            <div className="flex flex-wrap gap-2 print:hidden">
                <Button variant="ghost" onClick={download}>
                    {m.practice_download()}
                </Button>
                <Button variant="ghost" onClick={printPage}>
                    {m.practice_print()}
                </Button>
            </div>
        </section>
    );
}
