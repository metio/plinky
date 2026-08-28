// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Measures the difficulty model against repertoire whose real-world grade is known.
//
// `cost` is a number the model invents; a grade is a claim about a piano student. The
// only way to know whether one predicts the other is to hold the model up against pieces
// teachers have already graded. dev/grade-anchors.json names those pieces — teaching
// collections that are in the catalogue and sit at a settled level in the graded
// syllabuses — and this recomputes each one's cost from its own score.
//
// Two numbers come out. Spearman's rank correlation says whether the model orders pieces
// the way a teacher would, which is the only thing grade boundaries can preserve; no
// choice of boundary rescues a model that ranks badly. The per-grade cost medians are
// then what the boundaries are cut from.
//
// Run it after any change to core/fingering.ts or core/scoreDifficulty.ts.

import { readFile } from "node:fs/promises";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { readZip } from "./repairPitch.mts";
import { parsePositions, rawDifficulty, readKey, readRange } from "../core/scoreDifficulty.ts";

type Anchor = { grade: number; label: string; composer: string; title: string };
type Row = { id: string; title: string; composer: string; license: string; scoreKind?: string };

const median = (values: number[]): number =>
    values.length === 0 ? 0 : [...values].sort((a, b) => a - b)[values.length >> 1]!;

// Spearman's rho: Pearson over ranks, with ties sharing their mean rank.
export function spearman(xs: number[], ys: number[]): number {
    const ranked = (values: number[]): number[] => {
        const order = [...values.keys()].sort((a, b) => values[a]! - values[b]!);
        const ranks = new Array<number>(values.length).fill(0);
        for (let i = 0; i < order.length; ) {
            let j = i;
            while (j + 1 < order.length && values[order[j + 1]!] === values[order[i]!]) {
                j += 1;
            }
            for (let k = i; k <= j; k++) {
                ranks[order[k]!] = (i + j) / 2 + 1;
            }
            i = j + 1;
        }
        return ranks;
    };
    const [rx, ry] = [ranked(xs), ranked(ys)];
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const [mx, my] = [mean(rx), mean(ry)];
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < rx.length; i++) {
        num += (rx[i]! - mx) * (ry[i]! - my);
        dx += (rx[i]! - mx) ** 2;
        dy += (ry[i]! - my) ** 2;
    }
    return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

function scoreXml(buffer: Buffer): string {
    const main = readZip(buffer).find(
        (entry) => !entry.name.startsWith("META-INF") && /\.(xml|musicxml)$/i.test(entry.name),
    );
    return main ? main.data.toString("utf8") : "";
}

async function main() {
    const rows: Row[] = JSON.parse(await readFile("public/songs/manifest.json", "utf8"));
    const piano = rows.filter((row) => row.scoreKind === "solo-piano");
    const { anchors }: { anchors: Anchor[] } = JSON.parse(
        await readFile("dev/grade-anchors.json", "utf8"),
    );

    const measured: {
        grade: number;
        cost: number;
        label: string;
        title: string;
        notes: number;
        range: number;
        key: number;
    }[] = [];
    for (const anchor of anchors) {
        const composer = new RegExp(anchor.composer, "i");
        const title = new RegExp(anchor.title, "i");
        const hits = piano.filter((row) => composer.test(row.composer) && title.test(row.title));
        const costs: number[] = [];
        for (const hit of hits) {
            const buffer = await readFile(
                `public/songs/${hit.license.toLowerCase()}/${hit.id}.mxl`,
            ).catch(() => null);
            if (!buffer) {
                continue;
            }
            const xml = scoreXml(buffer);
            const cost = rawDifficulty(linkedomXmlCodec, xml);
            const hands = parsePositions(linkedomXmlCodec, xml);
            costs.push(cost);
            measured.push({
                grade: anchor.grade,
                cost,
                label: anchor.label,
                title: hit.title,
                notes: hands.right.length + hands.left.length,
                range: readRange(hands),
                key: readKey(linkedomXmlCodec.parse(xml)!),
            });
        }
        const shown = costs.length === 0 ? "—" : median(costs).toFixed(2).padStart(7);
        console.log(
            `g${anchor.grade}  n=${String(costs.length).padStart(3)}  med=${shown}  ${anchor.label}`,
        );
    }

    console.log(`\n${measured.length} anchor pieces`);
    const rho = spearman(
        measured.map((entry) => entry.grade),
        measured.map((entry) => entry.cost),
    );
    console.log(`Spearman over pieces      = ${rho.toFixed(3)}`);
    // Per collection as well as per piece: a collection with 33 scores in it would
    // otherwise decide the number on its own, and each collection is one observation
    // about the model however many editions of it the harvest happened to pick up.
    const labels = [...new Set(measured.map((entry) => entry.label))];
    const perLabel = labels.map((label) => {
        const mine = measured.filter((entry) => entry.label === label);
        return { grade: mine[0]!.grade, cost: median(mine.map((entry) => entry.cost)) };
    });
    const rhoLabels = spearman(
        perLabel.map((entry) => entry.grade),
        perLabel.map((entry) => entry.cost),
    );
    console.log(`Spearman over collections = ${rhoLabels.toFixed(3)}  (n=${labels.length})`);

    // Each ingredient on its own, so a term that is only standing in for length is
    // visible as one. Length is what the model is most careful not to charge for.
    console.log("\nwhat each ingredient predicts alone (Spearman over pieces):");
    const grades = measured.map((entry) => entry.grade);
    for (const [name, values] of [
        ["cost      ", measured.map((entry) => entry.cost)],
        ["note count", measured.map((entry) => entry.notes)],
        ["hand range", measured.map((entry) => entry.range)],
        ["key        ", measured.map((entry) => entry.key)],
    ] as [string, number[]][]) {
        console.log(`  ${name} = ${spearman(grades, values).toFixed(3)}`);
    }

    console.log("\nmedian cost per known grade:");
    for (let grade = 1; grade <= 8; grade++) {
        const costs = measured.filter((entry) => entry.grade === grade).map((entry) => entry.cost);
        if (costs.length > 0) {
            console.log(
                `  g${grade}  n=${String(costs.length).padStart(3)}  median ${median(costs).toFixed(3)}`,
            );
        }
    }

    console.log("\nboundaries these anchors imply:");
    console.log(`  ${JSON.stringify(boundariesFrom(perLabel))}`);
    console.log("  Paste into GRADE_THRESHOLDS.piece in core/scoreDifficulty.ts when the");
    console.log("  anchors have moved enough to be worth re-grading the catalogue for.");
}

// The least each grade's centre must sit above the one below it. The anchors cannot
// separate every pair — a collection graded 7 and one graded 8 can measure the same — and
// a grade with no room of its own would take no pieces at all.
const MIN_STEP = 1.5;

// Where the grade boundaries fall, given what each anchor collection measures.
//
// The centre of each grade is the mean of its collections, made monotone: a grade can
// never sit below the one beneath it, however the anchors happened to land, so wherever
// two grades are out of order they are pooled and given their shared mean. Grades the
// anchors say nothing about are carried by the trend on either side. The boundary between
// two grades is then the midpoint of their centres.
export function boundariesFrom(anchors: { grade: number; cost: number }[]): number[] {
    const centres: (number | null)[] = [];
    for (let grade = 1; grade <= 8; grade++) {
        const mine = anchors.filter((entry) => entry.grade === grade).map((entry) => entry.cost);
        centres.push(mine.length === 0 ? null : mine.reduce((a, b) => a + b, 0) / mine.length);
    }
    // Fill the gaps: the trend through the grades that do have anchors.
    const known = centres.flatMap((cost, i) => (cost === null ? [] : [{ i, cost }]));
    const step =
        known.length > 1
            ? (known.at(-1)!.cost - known[0]!.cost) / (known.at(-1)!.i - known[0]!.i)
            : MIN_STEP;
    const filled = centres.map((cost, i) => {
        if (cost !== null) {
            return cost;
        }
        const near = known.reduce((best, entry) =>
            Math.abs(entry.i - i) < Math.abs(best.i - i) ? entry : best,
        );
        return near.cost + (i - near.i) * step;
    });
    // Pool-adjacent-violators, then hold every grade MIN_STEP above the one below it.
    for (let i = 1; i < filled.length; i++) {
        if (filled[i]! >= filled[i - 1]! + MIN_STEP) {
            continue;
        }
        let start = i - 1;
        let sum = filled[i]! + filled[i - 1]!;
        let count = 2;
        while (start > 0 && sum / count < filled[start - 1]! + MIN_STEP) {
            start -= 1;
            sum += filled[start]!;
            count += 1;
        }
        const mean = sum / count;
        for (let k = 0; k < count; k++) {
            filled[start + k] = mean + k * MIN_STEP;
        }
    }
    // A boundary sits halfway between the grades it separates; there are one fewer of
    // them than there are grades.
    return filled.slice(0, -1).map((cost, i) => Number(((cost + filled[i + 1]!) / 2).toFixed(3)));
}

await main();
