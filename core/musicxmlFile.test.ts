// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { decompressMxl, readScoreFile } from "./musicxmlFile";

const XML = '<score-partwise><part id="P1"><measure number="1"/></part></score-partwise>';

const mxl = (rootPath = "score.xml", includeContainer = true): Uint8Array<ArrayBuffer> => {
    const files: Record<string, Uint8Array> = { [rootPath]: strToU8(XML) };
    if (includeContainer) {
        files["META-INF/container.xml"] = strToU8(
            `<container><rootfiles><rootfile full-path="${rootPath}"/></rootfiles></container>`,
        );
    }
    // Re-wrap so the bytes type as ArrayBuffer-backed, which the File constructor
    // (BlobPart) accepts under the strict lib.
    return new Uint8Array(zipSync(files));
};

describe("decompressMxl", () => {
    it("reads the rootfile named by the container", () => {
        expect(decompressMxl(mxl("music/score.xml"))).toBe(XML);
    });

    it("falls back to the first non-meta xml when there is no container", () => {
        expect(decompressMxl(mxl("score.xml", false))).toBe(XML);
    });

    it("scans for the score when the container names a rootfile that isn't in the zip", () => {
        // The container points at score.xml, but the zip actually holds real.xml.
        const files = {
            "real.xml": strToU8(XML),
            "META-INF/container.xml": strToU8(
                '<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>',
            ),
        };
        expect(decompressMxl(new Uint8Array(zipSync(files)))).toBe(XML);
    });

    it("accepts a .musicxml rootfile, not only .xml", () => {
        const files = { "score.musicxml": strToU8(XML) };
        expect(decompressMxl(new Uint8Array(zipSync(files)))).toBe(XML);
    });

    it("returns null for bytes that aren't a zip", () => {
        expect(decompressMxl(strToU8("not a zip"))).toBeNull();
    });
});

describe("readScoreFile", () => {
    it("decompresses a .mxl file by its zip signature", async () => {
        const file = new File([mxl()], "tune.mxl");
        expect(await readScoreFile(file)).toBe(XML);
    });

    it("reads a plain .musicxml file as text", async () => {
        const file = new File([XML], "tune.musicxml", { type: "application/xml" });
        expect(await readScoreFile(file)).toBe(XML);
    });

    it("decompresses by content even when the extension lies", async () => {
        // A .mxl saved as .xml still starts with the PK signature.
        const file = new File([mxl()], "mislabelled.xml");
        expect(await readScoreFile(file)).toBe(XML);
    });
});
