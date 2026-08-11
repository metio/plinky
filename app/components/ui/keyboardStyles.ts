// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The shared look of the on-screen keyboards — the landing hero and the practice
// trainer — so both read as the same instrument: a recessed keybed well and
// rounded keys with a soft shadow that dip when pressed. Each keyboard layers its
// own state colours on top: the hero's free-play green/violet, the trainer's
// functional indigo (the note to play next) and green (a key you're holding).
export const KEYBED_WELL = "rounded-2xl bg-subtle-strong p-3 shadow-inner";

export const WHITE_KEY =
    "relative rounded-b-lg border border-line-strong shadow-sm transition-[transform,background-color,box-shadow] duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring";

export const BLACK_KEY =
    "absolute top-0 rounded-b-md transition-[transform,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spark-soft";
