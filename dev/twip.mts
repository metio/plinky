// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Posts the week's changes to r/plinky_piano.
//
// Reads the same list NEWS.md is rendered from, so the round-up and the page players are
// sent to cannot disagree about what shipped.
//
// Three things keep an unattended weekly post honest:
//
// A week with nothing to say posts nothing. The failure mode of an automated digest is
// not a wrong post, it is "nothing happened this week" going out every Sunday until
// people stop reading the subreddit.
//
// It will not post twice. A re-run, a retry or a manual dispatch checks the subreddit's
// recent posts for the title first, so the state lives where the posts do rather than in
// a file somebody has to keep.
//
// It posts a SELF post, not a link. Reddit lets a text post's body be edited afterwards
// and does not let a link post's URL change, so a mistake is fixable in place.
//
// --dry-run renders what would be posted and exits. A manual dispatch of the workflow
// defaults to it, so seeing what would go out never risks sending it; the schedule is the
// only thing that posts for real.

import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { isDateKey } from "../core/dateKey";
import {
    parseChangelog,
    type PostedRoundUp,
    roundUp,
    roundUpBody,
    roundUpsToUnpin,
    roundUpTitle,
} from "../core/changelog";

const SUBREDDIT = "plinky_piano";
const WINDOW_DAYS = 7;
const AGENT = "plinky-twip/1.0 (by u/plinky_bot)";

const dry = process.argv.includes("--dry-run");

// The day the round-up covers up to. Passed in rather than read from a clock so a run can
// be reproduced, and so a missed week can be posted for the day it should have gone out.
//
// Every argument is accounted for. A date of the right shape but an impossible day —
// 2026-18-08, a transposed month and day — is not a small mistake here: `daysBetween`
// reports 0 for a date it cannot read, so the window would swallow the entire changelog
// and post it under a heading reading "8 18 2026". Anything unrecognised stops the run
// rather than quietly meaning today.
const args = process.argv.slice(2).filter((argument) => argument !== "--dry-run");
const [given, ...extra] = args;
if (extra.length > 0) {
    console.error(`Unexpected arguments: ${extra.join(" ")}`);
    process.exit(1);
}
if (given !== undefined && !isDateKey(given)) {
    console.error(`"${given}" is not a real day in YYYY-MM-DD form.`);
    process.exit(1);
}
const on = given ?? new Date().toISOString().slice(0, 10);

const { releases, problems } = parseChangelog(parse(await readFile("changelog.yaml", "utf8")));
if (problems.length > 0) {
    console.error(`changelog.yaml:\n- ${problems.join("\n- ")}`);
    process.exit(1);
}

const week = roundUp(releases, on, WINDOW_DAYS);
const title = roundUpTitle(on);

if (week.length === 0) {
    console.log(`Nothing to post for the week ending ${on}.`);
    process.exit(0);
}

const body = roundUpBody(week);
const entries = week.reduce((count, release) => count + release.entries.length, 0);
console.log(`${entries} entries across ${week.length} release(s) for the week ending ${on}.`);

if (dry) {
    console.log(`\n--- ${title}\n\n${body}`);
    process.exit(0);
}

const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD } = process.env;
if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
    console.error("Reddit credentials are missing; nothing was posted.");
    process.exit(1);
}

const basic = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64");
const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": AGENT,
    },
    body: new URLSearchParams({
        grant_type: "password",
        username: REDDIT_USERNAME,
        password: REDDIT_PASSWORD,
    }),
});
if (!tokenResponse.ok) {
    console.error(`Reddit refused the credentials: ${tokenResponse.status}`);
    process.exit(1);
}
const { access_token: token } = (await tokenResponse.json()) as { access_token?: string };
if (!token) {
    console.error("Reddit returned no access token.");
    process.exit(1);
}

const authorized = { authorization: `Bearer ${token}`, "user-agent": AGENT };

const recent = await fetch(`https://oauth.reddit.com/r/${SUBREDDIT}/new?limit=25`, {
    headers: authorized,
});
if (!recent.ok) {
    console.error(`Could not read r/${SUBREDDIT}: ${recent.status}`);
    process.exit(1);
}
const listing = (await recent.json()) as {
    data?: { children?: { data?: Partial<PostedRoundUp> }[] }
};
const posts: PostedRoundUp[] = (listing.data?.children ?? []).map((child) => ({
    name: child.data?.name ?? "",
    title: child.data?.title ?? "",
    stickied: child.data?.stickied ?? false,
}));

// The pin sits in the second slot, leaving the first for whatever the subreddit wants
// kept at the very top for good.
const SLOT = 2;

// Pinning is best-effort on purpose: the post is the point, and it has already landed by
// the time any of this runs. A subreddit that has not made the account a moderator, or a
// slot that will not free up, is worth saying out loud and not worth failing a job over —
// a failed job would only be re-run, find the post already there, and stop.
async function sticky(fullname: string, state: boolean): Promise<boolean> {
    const what = `${state ? "pin" : "unpin"} ${fullname}`;
    try {
        const response = await fetch("https://oauth.reddit.com/api/set_subreddit_sticky", {
            method: "POST",
            headers: { ...authorized, "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                id: fullname,
                state: String(state),
                num: String(SLOT),
                api_type: "json",
            }),
        });
        if (!response.ok) {
            console.warn(`Could not ${what}: ${response.status}`);
            return false;
        }
        // Reddit answers a refusal with 200 and an errors array — "not a moderator" among
        // them — so the status alone would report a pin that never happened.
        const answer = (await response.json().catch(() => ({}))) as {
            json?: { errors?: unknown[] };
        };
        const errors = answer.json?.errors ?? [];
        if (errors.length > 0) {
            console.warn(`Could not ${what}: ${JSON.stringify(errors)}`);
            return false;
        }
        return true;
    } catch (error) {
        // The post has already landed by the time any of this runs, so a network failure
        // here must not fail the job: a re-run would find the post and stop, leaving it
        // unpinned forever with a red tick to explain it.
        console.warn(`Could not ${what}: ${(error as Error).message}`);
        return false;
    }
}

// Last week's comes down before this week's goes up, or the third one would be refused.
async function pin(fullname: string): Promise<void> {
    for (const stale of roundUpsToUnpin(posts, title)) {
        await sticky(stale, false);
    }
    if (await sticky(fullname, true)) {
        console.log(`Pinned to the top of r/${SUBREDDIT}.`);
    }
}

// Already there? A retried job must not post the week twice — but it should still finish
// the job, so a run that posted and then failed to pin puts the pin right on the retry.
const already = posts.find((post) => post.title === title);
if (already) {
    console.log(`"${title}" is already posted.`);
    if (!already.stickied) {
        await pin(already.name);
    }
    process.exit(0);
}

const submitted = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: { ...authorized, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ sr: SUBREDDIT, kind: "self", title, text: body, api_type: "json" }),
});
// Status first: a rate limit or a gateway error answers with an HTML page, and parsing
// that as JSON throws a syntax error in place of the reason the post was refused.
if (!submitted.ok) {
    console.error(`Reddit refused the post: ${submitted.status} ${submitted.statusText}`);
    process.exit(1);
}
const result = (await submitted.json().catch(() => ({}))) as {
    json?: { errors?: unknown[]; data?: { url?: string; name?: string } };
};
if ((result.json?.errors?.length ?? 0) > 0) {
    console.error(`Reddit refused the post: ${JSON.stringify(result.json?.errors)}`);
    process.exit(1);
}
console.log(`Posted: ${result.json?.data?.url ?? `https://www.reddit.com/r/${SUBREDDIT}/`}`);

const posted = result.json?.data?.name;
if (posted) {
    await pin(posted);
} else {
    console.warn("Reddit returned no post id, so nothing was pinned.");
}
