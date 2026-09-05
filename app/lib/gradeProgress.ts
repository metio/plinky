// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { loadBundledScores, loadUserScores, userScoresRaw } from "./catalog";
import { earCatalogItems } from "./earProgress";
import { encodeIncipit, readIncipit } from "../../core/incipit";
import type { ItemKind } from "../../core/practisable";
import type { ScoreKind } from "../../core/scoreKind";
import type { Letter } from "../../core/grade";
import type { XmlCodec } from "../../core/xml";
import type { KeyValueStore } from "../ports/keyValueStore";
import { type DecayMode, REVIEW_CAP } from "../../core/review";
import { isDue, isLapsed, letterMin, type Mastery } from "../../core/mastery";
import { gradeOf, MAX_GRADE, parsePositions, rawDifficulty } from "../../core/scoreDifficulty";

// Plinky's progression: each of the 1–MAX_GRADE difficulty grades is a pool of
// catalogue items, and you climb by *mastering* items of a grade — not by any single
// thing. A grade earns a star tier at 5/12/25 mastered; you hold it by keeping those
// pieces fresh (light spaced-repetition review of what you already know); and an
// unbounded skill rating tracks the hardest you can play. Decay is a counting rule,
// never destructive: gentle counts everything learned, competitive stops counting a
// lapsed piece until it is refreshed — switching back restores it.

export type StarTier = "none" | "bronze" | "silver" | "gold";

// Mastered counts that earn each star tier within a single grade.
export const STAR_THRESHOLDS = { bronze: 5, silver: 12, gold: 25 } as const;

// How many of your hardest mastered pieces the skill rating averages.
const SKILL_TOP = 10;

// A catalogue item placed on the ladder, paired with the player's mastery of it.
export type GradedMastery = {
    id: string;
    title: string;
    grade: number;
    cost: number;
    kind: ItemKind;
    mastery: Mastery;
    // Rides along from the catalogue entry, so a list of what is fading can draw each
    // piece rather than only naming it.
    incipit?: string;
};

// Whether a piece counts toward its grade under the decay rule. Gentle counts every
// learned, un-shelved piece; competitive drops one that has lapsed until refreshed.
function counts(mastery: Mastery, mode: DecayMode, now: number): boolean {
    if (!mastery.learned || mastery.backlog) {
        return false;
    }
    return mode === "gentle" || !isLapsed(mastery, now);
}

// Where the player stands on the ladder, for choosing what to offer next: the grade held,
// the grade being worked toward, and the pieces already mastered that no offer should
// repeat. The Home panel's suggestion and the Stats page's up-next list are one shortlist
// read at different lengths, so both derive it here rather than each on its own.
//
// Mastered is read without the decay mode on purpose: a lapsed piece is still a learned
// one — it is due a refresh, not a first learning — so it is never offered as new.
export function ladderStanding(items: GradedMastery[]): {
    level: number;
    workingGrade: number;
    mastered: Set<string>;
} {
    const level = currentGrade(items);
    return {
        level,
        workingGrade: Math.min(level + 1, MAX_GRADE),
        mastered: new Set(
            items
                .filter((item) => item.mastery.learned && !item.mastery.backlog)
                .map((item) => item.id),
        ),
    };
}

// The pieces of one grade that still count as mastered under the chosen decay. Written once
// because the two readings below have to agree about what "in this grade" means: a count
// that disagrees with the list it is a count of is the kind of thing nobody notices.
function inGrade(
    items: GradedMastery[],
    grade: number,
    mode: DecayMode,
    now: number,
): GradedMastery[] {
    return items.filter((item) => item.grade === grade && counts(item.mastery, mode, now));
}

export function masteredInGrade(
    items: GradedMastery[],
    grade: number,
    mode: DecayMode,
    now: number,
): number {
    return inGrade(items, grade, mode, now).length;
}

export function starTier(masteredCount: number): StarTier {
    if (masteredCount >= STAR_THRESHOLDS.gold) {
        return "gold";
    }
    if (masteredCount >= STAR_THRESHOLDS.silver) {
        return "silver";
    }
    if (masteredCount >= STAR_THRESHOLDS.bronze) {
        return "bronze";
    }
    return "none";
}

// Ability over grind: the grade reached is the highest grade where you've played a few
// pieces *well* (at least B), not where you've ground out a full pool. So a strong player
// who sight-reads Grade 7 is placed at Grade 7 without first mastering five pieces of
// every grade below — but a single lucky run can't promote them, since it takes two.
// Ability is what you can do, so it doesn't decay (the stars and freshness below do).
export const ABILITY_LETTER: Letter = "B";
export const ABILITY_PIECES = 2;

// How many pieces of a grade you've played at the ability bar or better.
export function playedWellInGrade(items: GradedMastery[], grade: number): number {
    const bar = letterMin(ABILITY_LETTER);
    return items.filter((item) => item.grade === grade && item.mastery.bestScore >= bar).length;
}

export function currentGrade(items: GradedMastery[]): number {
    let grade = 0;
    for (let g = 1; g <= MAX_GRADE; g++) {
        if (playedWellInGrade(items, g) >= ABILITY_PIECES) {
            grade = g;
        }
    }
    return grade;
}

// A grade's mastered count and how many of those want a refresh, so the UI can show
// "✨ fresh" or "3 due to keep it sharp".
export function gradeFreshness(
    items: GradedMastery[],
    grade: number,
    mode: DecayMode,
    now: number,
): { mastered: number; due: number } {
    const kept = inGrade(items, grade, mode, now);
    return {
        mastered: kept.length,
        due: kept.filter((item) => isDue(item.mastery, now)).length,
    };
}

// The pieces to refresh now, most overdue first, capped so a day's maintenance stays
// gentle. Mode-independent: a lapsed piece (competitive's "lost" piece) is still due
// here, so refreshing it recovers it.
// What is due, longest-waiting first, capped. Returns the ITEMS: every caller wants
// something off them — a title, a kind, an incipit — and returning ids meant each one built
// a Map to undo the .map(item => item.id) this had just done, complete with a fallback for
// an item that cannot actually be missing, since the ids came from the same list.
export function dueItems(
    items: GradedMastery[],
    now: number,
    cap: number = REVIEW_CAP,
): GradedMastery[] {
    return (
        items
            .filter((item) => isDue(item.mastery, now))
            // Ear items belong here: the review session drives an ear drill for one, the
            // same way it opens a score for a piece.
            .sort((a, b) => a.mastery.reviewAt - b.mastery.reviewAt)
            .slice(0, cap)
    );
}

// An unbounded ability number: the average cost of your hardest mastered pieces,
// scaled to a friendly range. It rises as you master harder music and, in competitive
// mode, eases down as pieces lapse — the climb that never caps.
export function skillRating(items: GradedMastery[], mode: DecayMode, now: number): number {
    const costs = items
        .filter((item) => counts(item.mastery, mode, now))
        .map((item) => item.cost)
        .sort((a, b) => b - a)
        .slice(0, SKILL_TOP);
    if (costs.length === 0) {
        return 0;
    }
    return Math.round((100 * costs.reduce((sum, cost) => sum + cost, 0)) / costs.length);
}

// A catalogue item on the ladder, independent of any mastery — the pool a grade
// draws from. Its kind says how it is practised (a piece opens a score, an ear exercise
// runs a drill), so every reader dispatches on the field instead of the id.
export type GradeCatalogItem = {
    id: string;
    title: string;
    grade: number;
    cost: number;
    kind: ItemKind;
    // The piece's opening bars, encoded — what a row draws to name it. Rides along from
    // the manifest, or is read straight off a bundled or imported score's own notation.
    incipit?: string;
    // Solo piano, a song with a piano part, a choral setting. Absent for a generated
    // exercise and for a score held on the device, both of which are keyboard writing by
    // construction.
    scoreKind?: ScoreKind;
};

// Where the fetched manifests come from — structurally the song/exercise
// sources, taken as a parameter so the caller decides which services back the
// catalogue.
// What a source manifest carries per item — a ladder item minus its kind, since a
// manifest only ever describes pieces. buildCatalogue stamps the kind on.
export type ManifestItem = {
    id: string;
    title: string;
    grade: number;
    cost: number;
    incipit?: string;
    // What the piece is written for. Absent on an exercise manifest, whose rows carry a
    // `kind` of their own meaning which drill it is.
    scoreKind?: ScoreKind;
};

export type CatalogSources = {
    // Null signals a failed fetch (see the source contracts); the catalogue
    // treats it as contributing nothing this pass.
    songs: { manifest(): Promise<ManifestItem[] | null> };
    exercises: { manifest(): Promise<ManifestItem[] | null> };
    // Grading a bundled or imported score parses its MusicXML through this codec.
    xml: XmlCodec;
    // Imported scores live in persistent storage; bundled ones ship with the app.
    store: KeyValueStore;
};

// The whole gradeable catalogue, keyed by id: songs and exercises from their
// manifests (grade + cost precomputed), bundled and imported scores graded from their
// MusicXML. The pools the grades draw from.
// The last catalogue built, per store.
//
// Building one walks three thousand manifest entries and parses the MusicXML of every
// bundled and imported score, and both loaders below call it — so the Home panel that
// wants each of them paid for it twice, and the header badge paid again on every
// preference saved anywhere in the app. The manifests behind it are already cached for
// the session; this caches the assembling.
//
// Keyed on the store, so each test's isolated world keeps its own; validated against the
// sources it was built from and against the raw imported-scores string, so importing or
// removing a score rebuilds it rather than serving a catalogue that has quietly lost a
// piece. A WeakMap because a store that goes away should take its catalogue with it.
//
// What is held is the build in flight, not its result: the header badge and the Home
// panel's two loaders all ask within one tick of a cold load, before any of them could
// have finished, and each would otherwise assemble the whole catalogue for itself.
type BuiltCatalogue = {
    songs: CatalogSources["songs"];
    exercises: CatalogSources["exercises"];
    xml: XmlCodec;
    scores: string | null;
    index: Promise<Map<string, GradeCatalogItem>>;
};
const BUILT = new WeakMap<KeyValueStore, BuiltCatalogue>();

function buildCatalogue(sources: CatalogSources): Promise<Map<string, GradeCatalogItem>> {
    const scores = userScoresRaw(sources.store);
    const cached = BUILT.get(sources.store);
    if (
        cached &&
        cached.songs === sources.songs &&
        cached.exercises === sources.exercises &&
        cached.xml === sources.xml &&
        cached.scores === scores
    ) {
        return cached.index;
    }
    // A failed manifest (null) contributes nothing this pass, and the pass is served but
    // not remembered: the manifest layer keeps a failure out of its own cache so the next
    // call asks the network again, and remembering the gap here would stop that call
    // from ever being made — every song mastery would then read as "no catalogue match"
    // until a reload.
    let entry: BuiltCatalogue;
    const index = assembleCatalogue(sources).then(({ index, complete }) => {
        if (!complete && BUILT.get(sources.store) === entry) {
            BUILT.delete(sources.store);
        }
        return index;
    });
    entry = { songs: sources.songs, exercises: sources.exercises, xml: sources.xml, scores, index };
    BUILT.set(sources.store, entry);
    return index;
}

async function assembleCatalogue(
    sources: CatalogSources,
): Promise<{ index: Map<string, GradeCatalogItem>; complete: boolean }> {
    const index = new Map<string, GradeCatalogItem>();
    const [songList, exerciseList] = await Promise.all([
        sources.songs.manifest(),
        sources.exercises.manifest(),
    ]);
    const complete = songList !== null && exerciseList !== null;
    const songs = songList ?? [];
    const exercises = exerciseList ?? [];
    for (const song of songs) {
        index.set(song.id, { ...song, kind: "piece" });
    }
    for (const exercise of exercises) {
        index.set(exercise.id, { ...exercise, kind: "piece" });
    }
    // Ear items are a fixed, static pool — no manifest to fetch, no MusicXML to grade —
    // so they join the ladder directly. Placing them here is what makes an ear round
    // count toward standing, skill and the grade pools.
    for (const item of earCatalogItems()) {
        index.set(item.id, item);
    }
    for (const score of [...loadBundledScores(), ...loadUserScores(sources.store)]) {
        if (index.has(score.id)) {
            continue;
        }
        const { right, left } = parsePositions(sources.xml, score.xml);
        // A score with no fingerable notes — empty or unreadable — is nothing to
        // practise, so it stays out of the grade pools. Keeping it out also lets a
        // cost of 0 mean "measured as gentlest" everywhere, so the easy real pieces
        // that score 0 lead their grade rather than being mistaken for unmeasured.
        if (right.length + left.length === 0) {
            continue;
        }
        // The notation is already open here, so the mark costs one more read of it —
        // which is why a bundled demo and a score you imported yourself carry one just
        // as a catalogue piece does.
        const opening = readIncipit(sources.xml, score.xml);
        index.set(score.id, {
            id: score.id,
            title: score.title,
            grade: gradeOf(sources.xml, score.id, score.xml),
            cost: rawDifficulty(sources.xml, score.xml),
            kind: "piece",
            ...(opening ? { incipit: encodeIncipit(opening) } : {}),
        });
    }
    return { index, complete };
}

export async function loadGradeCatalogue(sources: CatalogSources): Promise<GradeCatalogItem[]> {
    return [...(await buildCatalogue(sources)).values()];
}

// Where the per-piece mastery entries come from — structurally the mastery store's
// loadAll, taken as a parameter so the caller decides which store backs the join.
export type MasterySource = { loadAll(): Array<{ id: string; value: Mastery }> };

// Joins the player's mastery with the catalogue to resolve each touched item's grade
// and cost. Items with no catalogue match are dropped.
export async function loadGradedMastery(
    source: MasterySource,
    sources: CatalogSources,
): Promise<GradedMastery[]> {
    const mastery = source.loadAll();
    if (mastery.length === 0) {
        return [];
    }
    const index = await buildCatalogue(sources);
    const out: GradedMastery[] = [];
    for (const { id, value: state } of mastery) {
        const meta = index.get(id);
        if (meta) {
            out.push({ ...meta, mastery: state });
        }
    }
    return out;
}

// The next star above the current mastered count and how many more pieces reach it,
// or null once Gold is held — the "3 to Silver" nudge.
export function nextStar(
    masteredCount: number,
): { tier: Exclude<StarTier, "none">; remaining: number } | null {
    if (masteredCount < STAR_THRESHOLDS.bronze) {
        return { tier: "bronze", remaining: STAR_THRESHOLDS.bronze - masteredCount };
    }
    if (masteredCount < STAR_THRESHOLDS.silver) {
        return { tier: "silver", remaining: STAR_THRESHOLDS.silver - masteredCount };
    }
    if (masteredCount < STAR_THRESHOLDS.gold) {
        return { tier: "gold", remaining: STAR_THRESHOLDS.gold - masteredCount };
    }
    return null;
}

// What to learn next in a grade: its gentlest not-yet-mastered pieces, easiest first
// by cost, so the climb through a grade stays gradual.
// Whether this is something to put in front of a player as their next piece.
//
// Roughly two thirds of the catalogue is a song with a piano part or a choral setting
// reduced to a grand staff. Both are playable — Plinky opens the piano part and can sound
// the rest as accompaniment — and neither is what a grade should be built from: a
// Schubert accompaniment offered as a first piece is a beginner meeting the wrong music.
// They stay in the library and out of the ladder.
//
// An item with no scoreKind is a generated exercise or a score the player holds on their
// own device, both keyboard writing by construction.
const forTheLadder = (item: GradeCatalogItem): boolean =>
    item.scoreKind === undefined || item.scoreKind === "solo-piano";

export function gradeSuggestions(
    catalogue: GradeCatalogItem[],
    grade: number,
    mastered: ReadonlySet<string>,
    count: number,
): GradeCatalogItem[] {
    return (
        catalogue
            .filter((item) => item.grade === grade && !mastered.has(item.id) && forTheLadder(item))
            // Easiest first by cost. Unplayable scores are kept out of the catalogue, so
            // a cost of 0 reliably means "gentlest" rather than "couldn't measure" — the
            // beginner-friendly pieces that score 0 lead their grade. An ear item stays in:
            // the link that opens it is chosen by its kind, so it needs no special case.
            .sort((a, b) => a.cost - b.cost)
            .slice(0, count)
    );
}

// How many gentlest pieces the "surprise me" flow rotates through, so repeated presses
// vary the pick instead of always opening the single easiest one.
const FLOW_WINDOW = 5;

// One piece to play right now, at the edge of the player's ability — a gentlest
// not-yet-mastered piece of the working grade, chosen from the flow window by a rotating
// seed so it varies press to press. When that grade is exhausted it widens to any
// unmastered piece, then (everything mastered) to the whole catalogue, so the button
// always opens something. Null only when the catalogue is empty.
export function surprisePick(
    catalogue: GradeCatalogItem[],
    grade: number,
    mastered: ReadonlySet<string>,
    seed: number,
): GradeCatalogItem | null {
    const gentlest = (items: GradeCatalogItem[]) =>
        [...items].sort((a, b) => a.cost - b.cost).slice(0, FLOW_WINDOW);
    const suggested = gradeSuggestions(catalogue, grade, mastered, FLOW_WINDOW);
    const unmastered = catalogue.filter((item) => !mastered.has(item.id));
    const pool =
        suggested.length > 0
            ? suggested
            : unmastered.length > 0
              ? gentlest(unmastered)
              : gentlest(catalogue);
    if (pool.length === 0) {
        return null;
    }
    return pool[((seed % pool.length) + pool.length) % pool.length]!;
}
