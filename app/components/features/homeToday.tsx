// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { arcadeConfig, currentArcadeLevel } from "../../../core/arcade";
import { dailyNumber, todayKey } from "../../../core/daily";
import { partOfDay } from "../../../core/greeting";
import { buildExerciseId, keyName } from "../../../core/exerciseGen";
import { type Letter, letterFor } from "../../../core/grade";
import { summarizePractice } from "../../../core/history";
import { type Standing, type StandingPart, standingParts } from "../../../core/standing";
import { LEARN_PICK_HREF, type LearnPickId, learnPick } from "../../../core/learnPick";
import { courseProgress, LESSONS } from "../../../core/theoryCourse";
import { practiceHref } from "../../../core/practisable";
import {
    currentGrade,
    dueReviews,
    type GradeCatalogItem,
    gradeSuggestions,
    loadGradeCatalogue,
    loadGradedMastery,
    skillRating,
    surprisePick,
} from "../../lib/gradeProgress";
import { HeroKeyboard } from "./heroKeyboard";
import { SurpriseButton } from "./surpriseButton";
import {
    useAssignmentsStore,
    useExerciseSource,
    useHistoryStore,
    useMasteryStore,
    useOnboardingStore,
    usePlacementStore,
    useTheoryStore,
    usePrefsStore,
    useServices,
} from "../../contexts/services";
import { nextAssignmentStep } from "../../../core/assignment";
import { useKnownPieces } from "../../hooks/useKnownPieces";
import { starterAssignment } from "../../../core/starterAssignments";
import { MAX_GRADE } from "../../../core/scoreDifficulty";
import { type Task, todayTasks } from "../../../core/today";
import { loadBundledScores } from "../../lib/catalog";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { BakedIncipit } from "../ui/incipit";
import { linkClasses } from "../ui/classes";
import { SettingsSection } from "../ui/settingsSection";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { localizedHref } from "../ui/href";
import { Show, useMidiConnected } from "./conditional";
import { usePrefs } from "../../hooks/usePrefs";

const ICON: Record<Task["key"], string> = {
    review: "🔁",
    daily: "📅",
    assignment: "📋",
    learn: "🎹",
    browse: "📚",
};

// What a row says, and what pressing it will do. A row that opens a piece names the
// piece: "Continue First steps — step 1 of 5" told a player who had never pressed
// anything that they were resuming, counted them against a list nobody handed them, and
// still did not say which piece was about to open. The set it came from is the line
// underneath, and the step only once there is a step to be at.
// Where a piece stands, for a row about a piece you have already played. A step
// advances when the piece is *learned*, and learned means a run reaching the grade set
// in Settings — so playing a piece through and seeing it offered again the next day is
// correct and, until this line existed, completely unexplained.
function bestLine(best: number | undefined, target: Letter): string | undefined {
    return best === undefined || best <= 0
        ? undefined
        : m.today_best_so_far({ best: letterFor(best), target });
}

function rowFor(
    task: Task,
    titles: Map<string, string>,
    bests: Map<string, number>,
    target: Letter,
): { label: string; hint?: string } {
    switch (task.key) {
        case "review": {
            // Name what is fading: three of them is enough to recognise the week's
            // work, and a row that says only "three pieces" makes you press it to
            // find out which.
            const named = task.ids
                .map((id) => titles.get(id))
                .filter((title): title is string => Boolean(title))
                .slice(0, 3);
            return {
                label: m.today_review({ count: task.count }),
                hint: named.length > 0 ? named.join(" · ") : undefined,
            };
        }
        case "daily":
            return { label: task.done ? m.today_daily_done() : m.today_daily() };
        case "assignment": {
            // Where in the set this is, said only once there is somewhere to be: a
            // player on the first step has not started, and counting them against a
            // list nobody handed them is the checklist this page is not.
            const where =
                task.step > 1
                    ? m.today_assignment_step({
                          name: task.name,
                          step: task.step,
                          total: task.total,
                      })
                    : m.today_assignment_set({ name: task.name });
            const best = bestLine(bests.get(task.id), target);
            // The catalogue does not know this piece — a shared set naming something
            // this device has not got. Name the set rather than invent a title.
            return {
                label: titles.get(task.id) ?? task.name,
                hint: best ? `${where} · ${best}` : where,
            };
        }
        case "learn":
            return {
                label: m.today_learn({ title: task.title }),
                hint: bestLine(bests.get(task.id), target),
            };
        case "browse":
            return { label: m.today_browse() };
    }
}

const LEARN_LABEL: Record<LearnPickId, () => string> = {
    basics: m.basics_title,
    placement: m.placement_title,
    theory: m.theory_title,
    glossary: m.glossary_title,
    methods: m.methods_title,
    tools: m.tools_title,
};

const LEARN_BLURB: Record<LearnPickId, () => string> = {
    basics: m.learn_basics_blurb,
    placement: m.placement_intro,
    theory: m.theory_intro,
    glossary: m.glossary_intro,
    methods: m.methods_intro,
    tools: m.tools_intro,
};

// A named part of the session. Headings, never steps: nothing counts them, nothing ticks
// them off, and skipping one costs nothing — a counter here would be a streak wearing a
// different hat. It is the same labelled group the set-up panel and Settings use, so a
// reader meets one shape rather than three.
function Moment({
    label,
    hint,
    hintTo,
    children,
}: {
    label: string;
    // A line under the moment's name. Where it is a thing to go and do, it links.
    hint?: string;
    hintTo?: string;
    children: ReactNode;
}) {
    return (
        <SettingsSection
            title={label}
            hint={
                hint && hintTo ? (
                    <Link to={hintTo} className={linkClasses}>
                        {hint}
                    </Link>
                ) : (
                    hint
                )
            }
        >
            {children}
        </SettingsSection>
    );
}

// What each moment takes up once it has arrived, measured off the settled page at a
// desktop width — the warm-up carries a keyboard, the work a row per piece, and the
// lesson a single line. Reserving it keeps the page still while the manifests land. A
// narrow screen wraps more and will still grow a little; the alternative is a page that
// jumps by two thirds of a screen, which is what this replaced.
const WAITING = [
    { label: m.today_moment_warmup, chips: 4, height: 216 },
    { label: m.today_moment_work, chips: 2, height: 112 },
    { label: m.today_moment_learn, chips: 1, height: 40 },
];

// One press, one start. `lead` marks the day's own thing — the challenge everybody
// gets, while it is still unopened — which is the only reason to weigh one of these
// more than the others.
function Chip({ to, lead = false, children }: { to: string; lead?: boolean; children: ReactNode }) {
    return (
        <Link
            to={to}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                lead
                    ? "border-spark bg-spark-surface text-spark-strong hover:border-spark-strong"
                    : "border-line-strong bg-sunken text-ink hover:border-accent-line-strong hover:text-accent-strong"
            }`}
        >
            {children}
        </Link>
    );
}

function Row({
    to,
    icon,
    label,
    hint,
    mark,
    action,
    primary = false,
}: {
    to: string;
    icon: string;
    label: string;
    hint?: string;
    // The piece's opening bars, when the catalogue carries them: a row about a piece of
    // music is better off showing the music than a pictogram of a piano.
    mark?: string;
    // What pressing the row does, said in a word. Only where the row's own text is the
    // name of something rather than an instruction.
    action?: string;
    // The day's first piece of work carries the filled action; everything under it is
    // quiet, so the eye lands somewhere rather than on four equal offers.
    primary?: boolean;
}) {
    return (
        <Link
            to={to}
            className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-subtle"
        >
            {mark ? (
                <BakedIncipit mark={mark} label={label} className="shrink-0 text-faint" />
            ) : (
                <span aria-hidden="true" className="text-xl">
                    {icon}
                </span>
            )}
            <span className="min-w-0 space-y-0.5">
                <span className="block font-medium text-ink group-hover:text-accent-strong">
                    {label}
                </span>
                {hint && <span className="block text-sm leading-snug text-muted">{hint}</span>}
            </span>
            <span
                aria-hidden="true"
                className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    primary
                        ? "bg-accent-solid text-white"
                        : "border border-line-strong text-accent-strong group-hover:border-accent-line-strong"
                }`}
            >
                {action ?? "→"}
            </span>
        </Link>
    );
}

const GREETING = {
    morning: m.today_greeting_morning,
    afternoon: m.today_greeting_afternoon,
    evening: m.today_greeting_evening,
    night: m.today_greeting_night,
};

// Where you stand, in one line: the grade you read at, the skill that rises as the
// music gets harder, and how much is on the stand. It answers "how am I doing" without
// asking anybody to go and look, and it is a description rather than a target — no
// progress bar, nothing to fill.
// The line under the greeting: core decides what there is to say, this says it.
const STANDING_PART: Record<StandingPart, (standing: Standing) => string> = {
    grade: ({ level }) => m.grade_label({ level }),
    "not-graded": () => m.grades_not_started(),
    skill: ({ skill }) => m.grades_skill({ rating: skill }),
    stand: ({ onStand }) =>
        onStand === 1 ? m.today_stand_one({ count: 1 }) : m.today_stand_other({ count: onStand }),
    notes: ({ notes }) => m.achievement_notes({ count: notes }),
};

function standingLine(standing: Standing): string {
    return standingParts(standing)
        .map((part) => STANDING_PART[part](standing))
        .join(" · ");
}

type Session = {
    tasks: Task[];
    standing: Standing;
    arcadeLevel: number;
    // Every catalogue title by id, so a row can name the piece it opens.
    titles: Map<string, string>;
    // The best a piece has been played, for the rows that say where one stands.
    bests: Map<string, number>;
    // The grade a run has to reach for a piece to count as learned (a Settings choice).
    target: Letter;
    nextLesson: string | undefined;
    // The opening bars of every piece the catalogue knows, so a row draws its own.
    marks: Map<string, string>;
    learn: LearnPickId;
    surprise: { catalogue: GradeCatalogItem[]; grade: number; mastered: Set<string> };
};

// The day's practice, in the shape a teacher gives an hour: something to warm up on,
// the piece you're working on, and one thing you didn't know before. Every part is
// composed from what the device already knows, so the page decides for the player
// instead of offering four lists and letting them choose which list to read.
//
// Reads local state after mount, so it is absent from the prerendered shell and
// appears once the client resolves it.
export function HomeToday() {
    const prefsStore = usePrefsStore();
    // The two things the day's practice can offer to set up, read live: an instrument to
    // play on, and the hand the finger positions are fitted to.
    const midiReady = useMidiConnected();
    const { prefs } = usePrefs();
    const handSet = prefs.handSpan.left !== null || prefs.handSpan.right !== null;
    const assignmentsStore = useAssignmentsStore();
    const masteryStore = useMasteryStore();
    const history = useHistoryStore();
    const onboarding = useOnboardingStore();
    const placement = usePlacementStore();
    const theory = useTheoryStore();
    const exercises = useExerciseSource();
    const services = useServices();
    // Skips steps whose pieces no longer resolve, so the Continue link never
    // lands on the play page's dead end. While the sources are still loading
    // (or unreachable) nothing reads as missing — the panel never blocks on,
    // or degrades with, the network.
    const known = useKnownPieces();
    const navigate = useNavigate();
    const [session, setSession] = useState<Session | null>(null);
    // The heading names the moment the reader arrived, which only their own clock
    // knows. Both the prerendered document and the first client render say "Today", so
    // hydration matches; the greeting arrives a tick later, in place, on one line.
    const [arrived, setArrived] = useState<Date | null>(null);
    useEffect(() => setArrived(new Date()), []);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            loadGradedMastery(services.mastery, services),
            loadGradeCatalogue(services),
            // The manifest only feeds the starter assignment; without it the
            // session still stands, so a fetch failure degrades to no starter
            // rather than an empty page.
            exercises.manifest().then((list) => list ?? []),
        ]).then(([items, catalogue, exerciseList]) => {
            if (cancelled) {
                return;
            }
            const now = Date.now();
            const prefs = prefsStore.load();
            const level = currentGrade(items);
            const workingGrade = Math.min(level + 1, MAX_GRADE);
            const mastered = new Set(
                items.filter((i) => i.mastery.learned && !i.mastery.backlog).map((i) => i.id),
            );
            const suggestion = gradeSuggestions(catalogue, workingGrade, mastered, 1)[0] ?? null;
            const day = dailyNumber(todayKey(new Date(now)));
            const dailyDoneToday = services.daily.lastDone() === day;
            // The player's own assignments first — a saved set is a deliberate
            // path — then the built-in starter, so a fresh device has a guided
            // path in the panel from day one. Same construction as on
            // /assignments, so the two views always agree on the steps.
            const starter = starterAssignment({
                id: "starter-first-steps",
                name: m.assignments_starter_name(),
                description: m.assignments_starter_description(),
                demos: loadBundledScores().map((score) => ({ id: score.id })),
                exercises: exerciseList,
            });
            const assignment = nextAssignmentStep(
                [...assignmentsStore.list(), ...(starter ? [starter] : [])],
                (id) => services.mastery.load(id)?.learned === true,
                (id) => known.isMissing(id),
            );
            // The due ids resolve back to their kind through the loaded items, so the
            // task knows whether opening one means a score or an ear drill.
            const kindById = new Map(items.map((i) => [i.id, i.kind]));
            setSession({
                tasks: todayTasks({
                    due: dueReviews(items, now, prefs.reviewCap).map((id) => ({
                        id,
                        kind: kindById.get(id) ?? "piece",
                    })),
                    dailyDoneToday,
                    assignment,
                    suggestion: suggestion
                        ? { id: suggestion.id, title: suggestion.title, kind: suggestion.kind }
                        : null,
                }),
                learn: learnPick({
                    keyboardMet: onboarding.marked().has("keyboardMet"),
                    placementTaken: placement.load() !== null,
                    courseDone: courseProgress(theory.met()) >= 1,
                    day,
                }),
                // Where the course has got to, so offering it opens the lesson you have
                // not met rather than the top of a page you are halfway down.
                nextLesson: LESSONS.find((lesson) => !theory.met().has(lesson.id))?.id,
                // The first arcade rung not yet cleared, read from the same mastery the
                // play surface records — so clearing a level advances it with nothing
                // bespoke behind it.
                arcadeLevel: currentArcadeLevel(
                    (lv) => masteryStore.load(buildExerciseId(arcadeConfig(lv)))?.learned === true,
                ),
                standing: {
                    level,
                    skill: skillRating(items, prefs.decayMode, now),
                    // What is on the stand: everything learned and not shelved — the
                    // same set the grades count, so the line agrees with the You page.
                    onStand: mastered.size,
                    notes: summarizePractice(history.load(), new Date(now)).totalNotes,
                },
                titles: new Map(catalogue.map((item) => [item.id, item.title])),
                bests: new Map(
                    items.flatMap((item) =>
                        item.mastery.bestScore > 0 ? [[item.id, item.mastery.bestScore]] : [],
                    ),
                ),
                target: prefs.masteryThreshold,
                marks: new Map(
                    catalogue.flatMap((item) => (item.incipit ? [[item.id, item.incipit]] : [])),
                ),
                surprise: { catalogue, grade: workingGrade, mastered },
            });
        });
        return () => {
            cancelled = true;
        };
    }, [
        prefsStore.load,
        assignmentsStore.list,
        exercises.manifest,
        history.load,
        masteryStore.load,
        onboarding.marked,
        placement.load,
        theory.met,
        services,
        known,
    ]);

    const heading = arrived
        ? GREETING[partOfDay(arrived.getHours())]({
              // The weekday is spelled and cased by the reader's own language, so the
              // message only has to say how its own words go around it.
              day: new Intl.DateTimeFormat(getLocale(), { weekday: "long" }).format(arrived),
          })
        : m.today_heading();

    const header = (
        <header className="space-y-1">
            {/* Most languages hand back a lowercase weekday — "mardi", "вторник",
                "tiistai" — which is correct for the word and wrong for the start of a
                heading. Lifting the first letter in CSS fixes every language at once,
                and does nothing at all to a script that has no capitals. */}
            <h1 className="font-display text-4xl font-semibold tracking-tight first-letter:uppercase sm:text-5xl">
                {heading}
            </h1>
            {/* Holds its line before the standing resolves, so the day's practice does
                not arrive by shoving the page down. */}
            <p className="min-h-5 text-sm text-muted">
                {session ? standingLine(session.standing) : ""}
            </p>
        </header>
    );

    // The day's three moments, in their places, before the manifests they are built from
    // have arrived. Without this the page was a header for a moment and then eight hundred
    // pixels taller, which shoves everything below it — the ways to practise, at the foot
    // of the page — down as you read. The shape is the real one; only the words are
    // waiting.
    if (session === null) {
        return (
            <div className="space-y-8" aria-busy="true">
                {header}
                {WAITING.map(({ label, chips, height }) => (
                    <Moment key={label()} label={label()}>
                        <div
                            className="flex flex-wrap content-start gap-2"
                            style={{ minHeight: `${height}px` }}
                            aria-hidden="true"
                        >
                            {Array.from({ length: chips }, (_, chip) => (
                                <span
                                    // biome-ignore lint/suspicious/noArrayIndexKey: a placeholder has no identity but its place in the row
                                    key={`${label()}-${chip}`}
                                    className="h-8 w-32 animate-pulse rounded-full bg-sunken motion-reduce:animate-none"
                                />
                            ))}
                        </div>
                    </Moment>
                ))}
                <p className="h-4" aria-hidden="true" />
            </div>
        );
    }

    // The daily belongs to the warm-up; everything else is the work.
    const daily = session.tasks.find((task) => task.key === "daily");
    const work = session.tasks.filter((task) => task.key !== "daily");
    const arcadeId = buildExerciseId(arcadeConfig(session.arcadeLevel));

    return (
        <div className="space-y-8">
            {header}

            <Moment label={m.today_moment_warmup()}>
                <div className="flex flex-wrap gap-2">
                    {daily && (
                        <Chip to={daily.to} lead={!daily.done}>
                            {rowFor(daily, session.titles, session.bests, session.target).label}
                        </Chip>
                    )}
                    {/* The endless ladder is one of the four, not a billboard beside
                        them. It used to carry the rung as a number, which told a reader
                        nothing: the ladder has no end, so seven is not seven of
                        anything. The key it is about to ask for is what a sight-reader
                        actually wants to know before pressing it. */}
                    <Chip to={`/play/${arcadeId}`}>
                        {m.arcade_title()}
                        <span className="rounded-full bg-subtle px-1.5 text-xs text-muted">
                            {keyName(arcadeConfig(session.arcadeLevel).key)}
                        </span>
                    </Chip>
                    <Chip to="/daily?tab=warmup">{m.today_drill()}</Chip>
                    <Chip to="/ear">{m.ear_title()}</Chip>
                </div>
                {/* Somewhere to put your hands before anything is asked of them. It is
                    the same instrument the practice surfaces use, so a warm-up here and
                    a run on a piece feel like one keyboard. */}
                <div className="space-y-1.5 pt-1">
                    <HeroKeyboard />
                    <p className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center text-sm text-muted">
                        <span>{m.home_keyboard_hint()}</span>
                        {/* The getting-started card used to ask for a piano in a list of
                            three chores at the foot of the page. It belongs here, under
                            the keys it is about, and only while there is no instrument —
                            taken, the offer disappears rather than ticking itself off. */}
                        <Show when={!midiReady}>
                            <Link to="/settings" className={linkClasses}>
                                {m.settings_connect_midi()}
                            </Link>
                            <span aria-hidden="true">·</span>
                            <Link to="/settings" className={linkClasses}>
                                {m.discover_keys()}
                            </Link>
                        </Show>
                    </p>
                </div>
            </Moment>

            <Moment
                label={m.today_moment_work()}
                // What a piece needs to know about you, asked where the pieces are and
                // only until it is answered: finger positions fit a hand, and a hand is
                // the one thing Plinky cannot measure for itself.
                hint={handSet ? undefined : m.grades_start_hand()}
                hintTo={handSet ? undefined : "/settings"}
            >
                <ul className="space-y-2">
                    {work.map((task, index) => {
                        const { label, hint } = rowFor(
                            task,
                            session.titles,
                            session.bests,
                            session.target,
                        );
                        const id = "id" in task ? task.id : undefined;
                        return (
                            <li key={task.key}>
                                <Row
                                    to={task.to}
                                    icon={ICON[task.key]}
                                    label={label}
                                    hint={hint}
                                    mark={id ? session.marks.get(id) : undefined}
                                    action={
                                        task.key === "assignment" || task.key === "learn"
                                            ? m.action_practice()
                                            : undefined
                                    }
                                    primary={index === 0}
                                />
                            </li>
                        );
                    })}
                </ul>
                <SurpriseButton
                    onClick={() => {
                        // A fresh seed per press. It used to be a counter starting at
                        // zero, held for as long as the page was mounted — so it rotated
                        // while you stayed, and every arrival began at zero again. Coming
                        // back from a piece meant being handed the same piece.
                        const pick = surprisePick(
                            session.surprise.catalogue,
                            session.surprise.grade,
                            session.surprise.mastered,
                            Math.floor(Math.random() * 1_000_000),
                        );
                        if (pick) {
                            navigate(localizedHref(practiceHref(pick)));
                        }
                    }}
                />
            </Moment>

            <Moment label={m.today_moment_learn()}>
                <Row
                    to={
                        session.learn === "theory" && session.nextLesson
                            ? `${LEARN_PICK_HREF.theory}#${session.nextLesson}`
                            : LEARN_PICK_HREF[session.learn]
                    }
                    icon="💡"
                    label={LEARN_LABEL[session.learn]()}
                    hint={LEARN_BLURB[session.learn]()}
                />
            </Moment>

            {/* The way out, for somebody who fancies none of it. Quiet on purpose: the
                page has already made its offers, and this is the shrug after them. */}
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-line pt-4 text-sm text-muted">
                <span>{m.today_something_else()}</span>
                <Link to="/library" className={linkClasses}>
                    {m.today_browse()}
                </Link>
                <span aria-hidden="true">·</span>
                <Link to="/compose" className={linkClasses}>
                    {m.play_compose()}
                </Link>
                <span aria-hidden="true">·</span>
                <Link to="/placement" className={linkClasses}>
                    {m.placement_title()}
                </Link>
                <span aria-hidden="true">·</span>
                {/* The badge beside the mark leads here too, but it is quiet until there
                    is a standing to show — so on a fresh device this is the only door,
                    and the page a player looks for after a while cannot depend on having
                    already earned something. */}
                <Link to="/stats" className={linkClasses}>
                    {m.nav_stats()}
                </Link>
            </p>
        </div>
    );
}
