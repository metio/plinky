<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# Translating Plinky

Plinky speaks 26 languages. Every UI string lives in `messages/<locale>.json`, with
English (`messages/en.json`) as the source. A string with no translation yet falls
back to English, so the app always works while a language catches up.

## The easy way — Fink

[Fink](https://fink.inlang.com) is a free, browser-based editor for these files —
no checkout, no tooling, nothing to install.

1. Open Fink and connect the `metio/plinky` repository. It reads the project from
   `project.inlang/settings.json`, so it works out of the box.
2. Pick a language. Fink lists every string still missing a translation.
3. Use **Machine translate** to draft them, then read each one through and fix
   anything that sounds off.
4. Fink opens a pull request with your changes.

## By hand

Prefer an editor? Translate the missing keys in `messages/<locale>.json` directly
(2-space JSON, the same keys as `messages/en.json`) and open a pull request. Run
`npm run messages` to recompile the typed message functions.

## Please keep

- **"Plinky"** unchanged — it's the name, not a word to translate.
- Placeholders such as `{count}` or `{title}` exactly as written, braces included.
- Emoji, and any leading or trailing spaces.
- The tone: short, friendly, and encouraging, like the English source.
- Music vocabulary in its conventional form for the language.
