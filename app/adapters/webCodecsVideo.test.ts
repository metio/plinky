// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { webCodecsVideoExporter } from "./webCodecsVideo";

// An engine without WebCodecs at all — node here, but equally a browser that
// never shipped the encoders. The whole point of the port is that the UI asks
// and simply doesn't offer the export, so answering the question must not
// depend on the APIs being there to answer it.
describe("webCodecsVideoExporter.supported", () => {
    it("reports unsupported where the encoders do not exist, without throwing", async () => {
        expect(typeof VideoEncoder).toBe("undefined");
        await expect(webCodecsVideoExporter.supported()).resolves.toBe(false);
    });
});
