// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds design-system/ — the card set pushed to claude.ai/design, so anything generated
// for Plinky later (a landing page, a poster, a mock-up) starts from Plinky's own
// vocabulary instead of a framework default.
//
// Generated for the same reason brand/ is: the tokens are read out of app/app.css and the
// mark out of public/icon.svg, so the design system cannot describe a version of the app
// that no longer exists. What it cannot derive — which component is worth showing, and
// what each one is FOR — is written here, once, beside the markup it renders.
//
// Each page is standalone HTML with its own copy of the tokens: the pane renders one card
// per file with nothing else loaded, so a shared stylesheet would leave every card blank.

import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUT = "design-system";
const CSS = "app/app.css";

// The tokens a card needs to look like Plinky. Everything else is composition.
const TOKENS = [
    "--color-surface",
    "--color-raised",
    "--color-sunken",
    "--color-subtle",
    "--color-subtle-strong",
    "--color-line",
    "--color-line-faint",
    "--color-line-strong",
    "--color-ink",
    "--color-ink-soft",
    "--color-body",
    "--color-muted",
    "--color-faint",
    "--color-accent",
    "--color-accent-strong",
    "--color-accent-deep",
    "--color-accent-surface",
    "--color-accent-fill",
    "--color-accent-line",
    "--color-accent-line-strong",
    "--color-spark",
    "--color-spark-strong",
    "--color-spark-soft",
    "--color-spark-surface",
    "--color-plink",
];

const css = await readFile(CSS, "utf8");
// The file carries width="192" height="192" so a browser can render it standalone; inside
// a card it has to take the size of the box it is put in, or it lands on the wordmark.
const icon = (await readFile("public/icon.svg", "utf8"))
    .replace(/ width="\d+"/, "")
    .replace(/ height="\d+"/, "")
    .replace("<svg ", '<svg style="width:100%;height:100%;display:block" ');

const light = (name) => {
    const at = css.indexOf(`${name}:`);
    if (at < 0) {
        throw new Error(`${name} is not in ${CSS}`);
    }
    return css.slice(at + name.length + 1, css.indexOf(";", at)).trim();
};
const dark = (name) => {
    const block = css.slice(css.indexOf(".dark"));
    const at = block.indexOf(`${name}:`);
    return at < 0 ? light(name) : block.slice(at + name.length + 1, block.indexOf(";", at)).trim();
};

const vars = (resolve) => TOKENS.map((name) => `    ${name}: ${resolve(name)};`).join("\n");

// One stylesheet, inlined into every card: the tokens in both themes, the two faces, and
// the handful of classes the app's own primitives resolve to.
const STYLE = `
:root {
${vars(light)}
    color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
${vars(dark)}
    }
}
:root[data-theme="dark"] {
${vars(dark)}
}
* { box-sizing: border-box; }
body {
    margin: 0;
    padding: 28px;
    background: var(--color-surface);
    color: var(--color-ink);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.5;
}
.display { font-family: Literata, Georgia, serif; font-weight: 600; letter-spacing: -0.01em; }
.stack { display: flex; flex-direction: column; gap: 20px; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.note { font-size: 13px; color: var(--color-muted); max-width: 60ch; }
.label {
    font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--color-spark-strong); border-bottom: 1px solid var(--color-line);
    padding-bottom: 6px;
}
.btn {
    min-height: 44px; padding: 0 18px; border-radius: 8px; border: 1px solid transparent;
    font: inherit; font-size: 14px; font-weight: 500; cursor: pointer;
}
.btn-primary { background: var(--color-accent); color: #fff; }
.btn-secondary { background: var(--color-accent-surface); color: var(--color-accent-strong); }
.btn-ghost { background: transparent; color: var(--color-accent-strong); }
.card {
    border-radius: 8px; background: var(--color-surface); border: 1px solid var(--color-line);
    padding: 16px;
}
.chip {
    min-height: 36px; padding: 0 14px; border-radius: 999px; font-size: 14px;
    border: 1px solid var(--color-line-strong); background: transparent;
    color: var(--color-ink); display: inline-flex; align-items: center; gap: 6px;
}
.chip[aria-pressed="true"] {
    border-color: var(--color-accent-line-strong); background: var(--color-accent-surface);
    color: var(--color-accent-strong); font-weight: 500;
}
.track { display: inline-flex; gap: 4px; padding: 4px; border-radius: 8px; background: var(--color-subtle); }
.seg {
    min-height: 44px; padding: 0 16px; border-radius: 6px; border: 0; background: transparent;
    font: inherit; font-size: 14px; font-weight: 500; color: var(--color-body);
}
.seg[aria-selected="true"] { background: var(--color-surface); color: var(--color-accent-strong); box-shadow: 0 1px 2px rgb(0 0 0 / 0.06); }
.loose { display: flex; flex-wrap: wrap; gap: 4px; }
.loose .seg { border: 1px solid var(--color-line-strong); border-radius: 999px; }
.loose .seg[aria-selected="true"] { border-color: var(--color-accent-line-strong); background: var(--color-accent-surface); box-shadow: none; }
`;

// The @dsCard marker has to be the first line — the pane reads the card's group off it —
// so the licence header follows it rather than opening the file.
const page = (card, title, body) =>
    `<!-- @dsCard group="${card.group}" -->
<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${STYLE}</style></head>
<body><div class="stack">${body}</div></body></html>
`;

// A staff fragment — the app's own way of naming a piece, and the device nothing else has.
const incipit = `<svg viewBox="0 0 92 30" width="92" height="30" role="img" aria-label="Opening bars" style="color:var(--color-faint)">
  <g stroke="currentColor" stroke-width="0.5" opacity="0.55">
    <line x1="0" y1="6" x2="92" y2="6"/><line x1="0" y1="11" x2="92" y2="11"/><line x1="0" y1="16" x2="92" y2="16"/><line x1="0" y1="21" x2="92" y2="21"/><line x1="0" y1="26" x2="92" y2="26"/>
  </g>
  <g fill="var(--color-ink)">
    ${[16, 26, 36, 46, 56, 66, 76]
        .map((x, i) => {
            const y = [21, 21, 18, 16, 16, 18, 21][i];
            return `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.9" transform="rotate(-18 ${x} ${y})"/><line x1="${x + 2.6}" y1="${y}" x2="${x + 2.6}" y2="${y - 11}" stroke="var(--color-ink)" stroke-width="0.7"/>`;
        })
        .join("")}
  </g>
</svg>`;

const CARDS = [
    {
        path: "foundations/colour.html",
        group: "Foundations",
        title: "Colour",
        body: `
  <div class="display" style="font-size:30px">Colour</div>
  <p class="note">Named for its role, never for its hue. Warmth comes from the ground and the type; the accent stays cool so it never argues with the grading.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px">
    ${[
        ["paper", "--color-surface", "the page, and the staff's own paper"],
        ["ink", "--color-ink", "type and staff lines"],
        ["pencil", "--color-muted", "hints, captions, asides"],
        ["rule", "--color-line", "hairlines and dividers"],
        ["brass", "--color-spark", "anything earned"],
        ["ink blue", "--color-accent", "anything you can press"],
        ["plink", "--color-plink", "the dot on the i. Nowhere else"],
    ]
        .map(
            ([name, token, why]) => `<div>
      <div style="height:64px;border-radius:6px;border:1px solid var(--color-line);background:var(${token})"></div>
      <div style="margin-top:8px;font-size:14px;font-weight:600">${name}</div>
      <div style="font-size:12px;color:var(--color-muted)">${why}</div>
    </div>`,
        )
        .join("")}
  </div>
  <p class="note"><strong>Spoken for:</strong> green means the note you found, red the one you missed, amber is caution and the top grade. On the one screen where colour is information, a decorative green is a lie — never borrow them.</p>`,
    },
    {
        path: "foundations/type.html",
        group: "Foundations",
        title: "Type",
        body: `
  <div class="label">Display — Literata</div>
  <div class="display" style="font-size:44px">Practise piano in your browser</div>
  <div class="display" style="font-size:28px">Tuesday morning</div>
  <div class="label" style="margin-top:8px">Interface — Inter</div>
  <div style="font-size:15px">Play it as slowly as you like — the notes wait for you.</div>
  <div style="font-size:13px;color:var(--color-muted)">Grade 3 · skill 214 · nine pieces on the stand</div>
  <div style="font-size:15px;font-variant-numeric:tabular-nums">♩ = 72 · bar 17 · 94%</div>
  <p class="note">Literata for anything titular — the genre children learn to read from. Inter for anything operable, because an interface face should disappear. Figures that line up in a column are tabular.</p>`,
    },
    {
        path: "brand/mark.html",
        group: "Brand",
        title: "The mark",
        body: `
  <div class="row" style="gap:24px">
    <div style="width:96px;height:96px">${icon}</div>
    <div class="display" style="font-size:52px">Pl<span style="position:relative">ı<span style="position:absolute;left:50%;top:.16em;width:.15em;height:.15em;transform:translateX(-50%);border-radius:999px;background:var(--color-plink)"></span></span>nky</div>
  </div>
  <p class="note">A keyboard, and one note leaving it. That note is the plink — what a single note sounds like, and where the name comes from — and it is the only pink in Plinky: above the keys in the icon, on the i in the wordmark, nowhere else. The mark sits inside the middle 80% of its square so a launcher can crop it without taking a key off the end.</p>`,
    },
    {
        path: "components/button.html",
        group: "Components",
        title: "Button",
        body: `
  <div class="label">Button</div>
  <div class="row">
    <button class="btn btn-primary">Practice</button>
    <button class="btn btn-secondary">Browse the library</button>
    <button class="btn btn-ghost">Skip</button>
    <button class="btn btn-secondary" disabled style="opacity:.5">Unavailable</button>
  </div>
  <p class="note">One primary per surface — it is the thing to press. Secondary carries the cool accent tint that means pressable; ghost is for a control strip where a filled shape would shout. A selected state is never a Button: that is a Segmented control or a Chip.</p>`,
    },
    {
        path: "components/card.html",
        group: "Components",
        title: "Card",
        body: `
  <div class="label">Card</div>
  <div class="card" style="display:flex;flex-direction:column;gap:8px">
    <div style="font-size:15px;font-weight:600">Slow enough to get it right</div>
    <div style="font-size:14px">Drop the tempo until every note lands where you meant it.</div>
    <div style="font-size:13px;color:var(--color-muted)">Whatever you play is what you learn, mistakes included.</div>
    <div class="row"><button class="btn btn-secondary">Browse the library</button></div>
  </div>
  <p class="note">One radius, one hairline, one ground, three paddings. A quieter card drops the border and keeps everything else — the corner means "a panel", so it must never vary.</p>`,
    },
    {
        path: "components/page-header.html",
        group: "Components",
        title: "Page header",
        body: `
  <div class="label">Page header</div>
  <div>
    <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px">
      <div class="display" style="font-size:30px">Ways to practise</div>
      <button class="btn btn-ghost">Export</button>
    </div>
    <div style="font-size:14px;color:var(--color-muted);margin-top:4px">Six things a teacher would suggest, and where in Plinky to do each one.</div>
  </div>
  <p class="note">Every page opens the same way: an optional line of small caps, the name in the display face, a line under it, and a slot on the right for whatever that page offers. A route never writes its own title.</p>`,
    },
    {
        path: "components/section.html",
        group: "Components",
        title: "Section",
        body: `
  <div class="label">Warm up</div>
  <div class="row">
    <button class="chip" aria-pressed="true">Today's challenge</button>
    <button class="chip" aria-pressed="false">A fresh drill</button>
  </div>
  <div class="label" style="margin-top:14px">Work on</div>
  <div class="row" style="gap:10px">${incipit}<span style="font-weight:500">Ode to Joy</span></div>
  <p class="note">Small letter-spaced brass caps over a hairline: the app's one way of saying "these belong together". It labels the day's moments, a course's unit, a settings group and a section of a page — learn it once, recognise it everywhere.</p>`,
    },
    {
        path: "components/segmented-control.html",
        group: "Components",
        title: "Segmented control",
        body: `
  <div class="label">Up to six — a track</div>
  <div class="track" role="tablist">
    <button class="seg" role="tab" aria-selected="true">Search</button>
    <button class="seg" role="tab" aria-selected="false">Composers</button>
    <button class="seg" role="tab" aria-selected="false">Manage</button>
  </div>
  <div class="label" style="margin-top:14px">Past six — outlines</div>
  <div class="loose" role="tablist">
    ${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
        .map(
            (note, i) =>
                `<button class="seg" role="tab" aria-selected="${i === 0}">${note}</button>`,
        )
        .join("")}
  </div>
  <p class="note">A recessed track reads as one control while its options fit a line or two, and as a tag cloud the moment they wrap. Past six the same control drops the track and outlines each option instead — same roles, same behaviour, a shape that survives wrapping.</p>`,
    },
    {
        path: "components/chip.html",
        group: "Components",
        title: "Chip",
        body: `
  <div class="label">Show</div>
  <div class="row">
    <button class="chip" aria-pressed="true">★ Favourites</button>
    <button class="chip" aria-pressed="false">✨ Not tried yet</button>
    <button class="chip" aria-pressed="false">⏰ Due now</button>
  </div>
  <p class="note">Multi-select, and each one stands alone: a filter you can turn on beside any other. Single-select of a bounded set is a Segmented control — the two look different on purpose.</p>`,
    },
    {
        path: "components/empty-state.html",
        group: "Components",
        title: "Empty state",
        body: `
  <div class="display" style="font-size:26px">Review session</div>
  <div style="font-size:14px;color:var(--color-muted)">Nothing to review — everything's fresh!</div>
  <div style="font-size:14px;color:var(--color-muted)">Pieces resurface on a widening schedule, so what you've learned actually sticks.</div>
  <div class="row"><button class="btn btn-primary">Browse the library</button></div>
  <p class="note">The page's own left edge, a line saying what the emptiness means, and one thing to press. An empty screen is an invitation, so it always offers a way on — never a centred box, never a shrug.</p>`,
    },
    {
        path: "components/piece-row.html",
        group: "Components",
        title: "A piece, in a list",
        body: `
  <div class="label">Ready for you</div>
  <div style="display:flex;flex-direction:column">
    ${[
        ["Hänschen Klein", "Deutsches Kinderlied", "1"],
        ["Gymnopédie No. 1", "Erik Satie", "4"],
        ["Sonate K.331", "Wolfgang Amadeus Mozart", "6"],
    ]
        .map(
            ([title, composer, grade]) => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--color-line-faint)">
      ${incipit}
      <div style="min-width:0;flex:1">
        <div style="font-weight:500">${title}</div>
        <div style="font-size:12px;color:var(--color-muted)">${composer}</div>
      </div>
      <span style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--color-spark-surface);color:var(--color-spark-strong);font-weight:500">Grade ${grade}</span>
    </div>`,
        )
        .join("")}
  </div>
  <p class="note">A piece is named by its opening bars before it is named by its title — the way a thematic catalogue has identified works for two centuries, and the one device Plinky has that is ornament, identifier and reading practice at once. A piece with no mark on file keeps the slot, so the titles stay in one column.</p>`,
    },
];

await mkdir(`${OUT}/foundations`, { recursive: true });
await mkdir(`${OUT}/components`, { recursive: true });
await mkdir(`${OUT}/brand`, { recursive: true });

for (const card of CARDS) {
    await writeFile(`${OUT}/${card.path}`, page(card, `Plinky — ${card.title}`, card.body));
}

await writeFile(
    `${OUT}/README.md`,
    `<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# The Plinky design system

Generated by \`npm run design-system\` from \`app/app.css\` and \`public/icon.svg\`, and pushed
to claude.ai/design so anything made for Plinky later starts from Plinky's own vocabulary.

It is a mirror, never the source: the app's tokens and components are the truth, and this
is regenerated from them. If a card and the app disagree, the app is right and the script
needs running.

${CARDS.map((card) => `- \`${card.path}\` — ${card.title}`).join("\n")}
`,
);

console.log(`design-system/: ${CARDS.length} cards from ${CSS}`);
