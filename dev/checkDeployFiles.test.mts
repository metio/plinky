// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkDeployFiles, countFiles } from "./check-deploy-files.mjs";

function tree(files: number): string {
    const dir = mkdtempSync(join(tmpdir(), "deploy-"));
    mkdirSync(join(dir, "og"));
    for (let index = 0; index < files; index += 1) {
        writeFileSync(join(dir, index % 2 ? "og" : "", `${index}.txt`), "");
    }
    return dir;
}

describe("checkDeployFiles", () => {
    it("counts every file under the tree", () => {
        expect(countFiles(tree(7))).toBe(7);
    });

    it("refuses a tree past the host's cap, naming the cap", () => {
        expect(() => checkDeployFiles(tree(12), 10, 2)).toThrow(/12 files.*at most 10/);
    });

    it("warns inside the margin and passes", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(checkDeployFiles(tree(9), 10, 2)).toBe(9);
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it("says nothing with room to spare", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(checkDeployFiles(tree(3), 10, 2)).toBe(3);
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
