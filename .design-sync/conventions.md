<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

## Building with Plinky

Plinky is a piano practice app: a player reads notation on screen and plays along on a
MIDI keyboard, the computer keyboard, or an on-screen one. It is touch-first, warm rather
than clinical, and it never pressures anybody — there are no streaks and no leaderboards,
so never design one.

### Wrapping

Every component mounts inside a router and the MIDI context:

```jsx
<MemoryRouter>
  <MidiProvider>
    <Button variant="primary">Practise</Button>
  </MidiProvider>
</MemoryRouter>
```

Both are exports of this library. Without the router, anything containing a link throws
on a null navigation context; without `MidiProvider`, anything reading a keyboard's state
throws. A component that needs device storage — the panels that show takes, backups or
progress — additionally wants `<ServicesProvider services={{ store: … }}>` inside those
two.

Dark mode is a `dark` class on the root element, not a prop.

### Colour is named for its role, never for its hue

Every colour is a Tailwind utility over a token defined in `_ds/plinky/styles.css`. Write
`text-muted`, never `text-gray-500 dark:text-gray-400` — each token already resolves to
its own light and dark value, so a raw palette utility is both wrong in one theme and
outside the system.

| Family | Names | For |
| --- | --- | --- |
| Ground | `surface` `raised` `sunken` `subtle` `subtle-strong` | Pages and panels, lightest to most recessed |
| Ink | `ink` `ink-soft` `body` `muted` `faint` | Type, from headings down to asides |
| Line | `line` `line-faint` `line-strong` | Hairlines, dividers, input borders |
| Accent | `accent` `accent-strong` `accent-solid` `accent-surface` `accent-fill` `accent-line` | Anything pressable. A deep ink blue that stays cool |
| Earned | `spark` `spark-strong` `spark-soft` `spark-surface` | Stars, grades, the day's own thing. Brass |
| State | `success` `warn` `danger` `info` (each with `-surface`, `-line`, `-solid`) | Feedback |
| Signature | `plink` | The dot on the i, and the note in the icon. Nowhere else |

**Four families carry meaning and must never be borrowed for decoration.** `success` is
the note the player found and `danger` the one they missed; `band-best` through
`band-none` are the five bands of the daily share grid, matched to emoji and to hexes
baked into an exported image; `hand-left` / `hand-right` distinguish the two hands on a
staff; `grade-s` through `grade-f` are the grade letters. A decorative green on a screen
where colour is the information is a lie.

Two type tokens: `font-display` is Literata, for anything titular; `font-sans` is Inter,
for anything operable — controls, tables, labels, numbers. Numbers that line up in a
column are set `tabular-nums`.

### The primitives

`Button` takes `variant`: `primary` (one per surface — the thing to press), `secondary`
(the cool accent tint that means pressable), `ghost` (a control strip where a filled
shape would shout), `danger`, and `plain` (for a button that sets its own colour to
signal state). Every button clears a 44px tap target. A selected state is never a
`Button` — that is `SegmentedControl` for a single choice from a bounded set, or `Chip`
for multi-select filters that each stand alone. `buttonClasses(variant)` gives the same
look to an element that must not be a `<button>` — a `<Link>`, a file-input `<label>`.

`Card` is one radius, one hairline, one ground; a caller chooses only `pad`
(`snug`/`normal`/`roomy`) and `quiet` to drop the border. `PageHeader` opens every page:
an optional line of small caps, the name in the display face, a line under it, and a slot
on the right. A route never writes its own title. `EmptyState` says what the emptiness
means and offers one thing to press — never a centred shrug.

Small letter-spaced brass caps over a hairline are the app's one way of saying "these
belong together": `sectionLabelClasses` and `sectionHeadingClasses`. `fieldClasses` and
`compactFieldClasses` are the two text inputs; `linkClasses` the inline link.

`IncipitMark` draws a piece's opening bars as a small staff — a piece is named by how it
starts before it is named by its title, which is how thematic catalogues have identified
works for two centuries.

### Where the truth is

Read `_ds/plinky/styles.css` and its imports for the full token set, and each component's
own `.prompt.md` and `.d.ts` for its API. Both beat any summary here.

### Voice

Plinky talks like a teacher who is glad you showed up: it invites, it never nags. Say what
the reader gets, not what the product does, and never promise something the app cannot
deliver in one tap. Never write a streak, a rank, or "practise daily or lose your
progress".
