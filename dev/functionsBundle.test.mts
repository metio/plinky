// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readdirSync, readFileSync } from "node:fs";
import { transformWithEsbuild } from "vite";
import { describe, expect, it } from "vitest";

// Cloudflare's Pages build hands every module under functions/ to esbuild — the type
// declarations beside the middleware included — and a file esbuild refuses fails the
// preview and the deploy while every other gate stays green. So each one has to compile the
// way that build compiles it.
const compile = (source: string, file: string) =>
    transformWithEsbuild(source, file, { loader: file.endsWith(".js") ? "js" : "ts" });

const modules = readdirSync("functions").filter(
    (file) => /\.(js|ts)$/.test(file) && !file.includes(".test."),
);

describe("functions/", () => {
    it("holds the middleware and its declarations", () => {
        expect(modules).toEqual(expect.arrayContaining(["_middleware.js", "_middleware.d.ts"]));
    });

    it.each(modules)("%s compiles the way the Pages build compiles it", async (file) => {
        await expect(
            compile(readFileSync(`functions/${file}`, "utf8"), file),
        ).resolves.toBeDefined();
    });

    it("refuses a declared constant without `declare`, the shape the Pages build rejects", async () => {
        await expect(compile("export const X: string;\n", "x.d.ts")).rejects.toThrow(
            /must be initialized/,
        );
        await expect(compile("export declare const X: string;\n", "x.d.ts")).resolves.toBeDefined();
    });
});
