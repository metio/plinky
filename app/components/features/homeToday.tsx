// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { dailyNumber, todayKey } from "../../../core/daily";
import { LEARN_PICK_HREF, type LearnPickId, learnPick } from "../../../core/learnPick";
import { practiceHref } from "../../../core/practisable";
import {
    currentGrade,
    dueReviews,
    type GradeCatalogItem,
    gradeSuggestions,
    loadGradeCatalogue,
    loadGradedMastery,
    surprisePick,
} from "../../lib/gradeProgress";
import { ArcadeCard } from "./arcadeCard";
import { SurpriseButton } from "./surpriseButton";
import {
    useAssignmentsStore,
    useExerciseSource,
    useOnboardingStore,
    usePlacementStore,
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
import { LocalizedLink as Link } from "../ui/localizedLink";
import { localizedHref } from "../ui/href";

const ICON: Record<Task["key"], string> = {
    review: "🔁",
    daily: "📅",
    assignment: "📋",
    learn: "🎹",
    browse: "📚",
};

function taskLabel(task: Task): string {
    switch (task.key) {
        case "review":
            return m.today_review({ count: task.count });
        case "daily":
            return task.done ? m.today_daily_done() : m.today_daily();
        case "assignment":
            return m.today_assignment({ name: task.name, step: task.step, total: task.total });
        case "learn":
            return m.today_learn({ title: task.title });
        case "browse":
            return m.today_browse();
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
    basics: m.basics_intro,
    placement: m.placement_intro,
    theory: m.theory_intro,
    glossary: m.glossary_intro,
    methods: m.methods_intro,
    tools: m.tools_intro,
};

// A named part of the session. Headings, never steps: nothing counts them, nothing
// ticks them off, and skipping one costs nothing — a counter here would be a streak
// wearing a different hat.
function Moment({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="border-b border-line pb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {label}
            </h2>
            {children}
        </section>
    );
}

function Chip({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link
            to={to}
            className="rounded-full border border-line-strong bg-sunken px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-accent-line-strong hover:text-accent-strong"
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
}: {
    to: string;
    icon: string;
    label: string;
    hint?: string;
}) {
    return (
        <Link
            to={to}
            className="group flex items-center gap-3 rounded-lg border border-line bg-raised p-3 transition hover:-translate-y-0.5 hover:border-accent-line-strong hover:shadow-sm"
        >
            <span aria-hidden="true" className="text-xl">
                {icon}
            </span>
            <span className="min-w-0 space-y-0.5">
                <span className="block font-medium text-ink group-hover:text-accent-strong">
                    {label} →
                </span>
                {hint && <span className="block text-sm leading-snug text-muted">{hint}</span>}
            </span>
        </Link>
    );
}

type Session = {
    tasks: Task[];
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
    const assignmentsStore = useAssignmentsStore();
    const onboarding = useOnboardingStore();
    const placement = usePlacementStore();
    const exercises = useExerciseSource();
    const services = useServices();
    // Skips steps whose pieces no longer resolve, so the Continue link never
    // lands on the play page's dead end. While the sources are still loading
    // (or unreachable) nothing reads as missing — the panel never blocks on,
    // or degrades with, the network.
    const known = useKnownPieces();
    const navigate = useNavigate();
    const [session, setSession] = useState<Session | null>(null);
    const seedRef = useRef(0);

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
                    day,
                }),
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
        onboarding.marked,
        placement.load,
        services,
        known,
    ]);

    if (session === null) {
        return null;
    }

    // The daily belongs to the warm-up; everything else is the work.
    const daily = session.tasks.find((task) => task.key === "daily");
    const work = session.tasks.filter((task) => task.key !== "daily");

    return (
        <div className="space-y-8">
            <Moment label={m.today_moment_warmup()}>
                <div className="flex flex-wrap gap-2">
                    {daily && <Chip to={daily.to}>{taskLabel(daily)}</Chip>}
                    <Chip to="/daily?tab=warmup">{m.today_drill()}</Chip>
                    <Chip to="/ear">{m.ear_title()}</Chip>
                </div>
                {/* The endless ladder keeps its card: a chip reading "Play level 7"
                    names nothing, and the arcade is the one warm-up that has to say
                    what it is before anybody presses it. */}
                <ArcadeCard />
            </Moment>

            <Moment label={m.today_moment_work()}>
                <ul className="space-y-2">
                    {work.map((task) => (
                        <li key={task.key}>
                            <Row to={task.to} icon={ICON[task.key]} label={taskLabel(task)} />
                        </li>
                    ))}
                </ul>
                <SurpriseButton
                    onClick={() => {
                        const pick = surprisePick(
                            session.surprise.catalogue,
                            session.surprise.grade,
                            session.surprise.mastered,
                            seedRef.current++,
                        );
                        if (pick) {
                            navigate(localizedHref(practiceHref(pick)));
                        }
                    }}
                />
            </Moment>

            <Moment label={m.today_moment_learn()}>
                <Row
                    to={LEARN_PICK_HREF[session.learn]}
                    icon="💡"
                    label={LEARN_LABEL[session.learn]()}
                    hint={LEARN_BLURB[session.learn]()}
                />
            </Moment>
        </div>
    );
}
