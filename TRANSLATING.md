<!--
SPDX-FileCopyrightText: The Plinky Authors
SPDX-License-Identifier: 0BSD
-->

# Translating Plinky

Plinky speaks 26 languages. Every UI string lives in `messages/<locale>.json`, with
English (`messages/en.json`) as the source. A string with no translation yet falls
back to English, so the app always works while a language catches up.

## How to translate

1. Open `messages/<locale>.json` for the language you want to help with.
2. Compare it with `messages/en.json` and add the keys it's missing — those are the
   strings still showing in English. Keep the keys in the same order as `en.json`.
3. Run `npm run messages` to recompile the typed message functions, then open a pull
   request.

The files are plain 2-space JSON. Each key maps to its translated string; the same
key must exist in `en.json`.

## Please keep

- **"Plinky"** unchanged — it's the name, not a word to translate.
- Placeholders such as `{count}` or `{title}` exactly as written, braces included.
- Emoji, and any leading or trailing spaces.
- The tone: short, friendly, and encouraging, like the English source.
- Music vocabulary in its conventional form for the language.
