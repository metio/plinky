// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which slice of the song catalogue a piece's metadata lives in.
//
// Opening one piece needed the whole catalogue: six hundred kilobytes of every song's
// metadata, downloaded to read one row of it, on the critical path before a single note
// could be engraved. Measured on a throttled connection that is most of a second, spent on
// 3055 pieces the reader did not ask for.
//
// So the manifest is also written out in slices, and opening a piece reads only the slice
// its id falls in — about ten kilobytes. The full manifest stays exactly as it was, for the
// pages that genuinely browse the catalogue.
//
// A slice is NAMED by a number, not by a character of the id, and that is the point: ids are
// case-sensitive and filenames on some filesystems are not, so a slice called `a` and one
// called `A` would be two files on Linux and one on macOS, with half the catalogue
// unreachable on exactly one of them. A number cannot be case-folded.
//
// Ids sharing a slice is the design, not a fault — three thousand pieces across sixty-four
// slices is about fifty each, which is the ten kilobytes this exists to fetch instead of six
// hundred. What matters is only that the slices come out roughly even, which is why this
// hashes the whole id (djb2, position-weighted) rather than bucketing on its first
// character, where the alphabet is nothing like evenly used.
export const SHARD_COUNT = 64;

export function shardOf(id: string): number {
    let hash = 5381;
    for (let index = 0; index < id.length; index++) {
        // Kept inside 32 bits at every step: past 2^53 the additions stop being exact and
        // two machines could disagree about where a piece lives.
        hash = (Math.imul(hash, 33) + id.charCodeAt(index)) | 0;
    }
    return Math.abs(hash) % SHARD_COUNT;
}

// The slice's name, zero-padded so a directory listing sorts the way the numbers do.
export function shardName(id: string): string {
    return String(shardOf(id)).padStart(2, "0");
}
