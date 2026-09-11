// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it } from "vitest";
import { typingInto } from "./typingInto";

// Editable content is a real browser's judgement: jsdom does not implement isContentEditable,
// so only here can a rich-text field be asked whether the player is typing into it.
describe("typingInto in a real browser", () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it("leaves a key to editable content, down to the words inside it", () => {
        const editor = document.createElement("div");
        editor.contentEditable = "true";
        const word = document.createElement("span");
        editor.append(word);
        document.body.append(editor);
        expect(typingInto(editor)).toBe(true);
        expect(typingInto(word)).toBe(true);
    });

    it("lets a page shortcut have a key pressed on content nobody can edit", () => {
        const text = document.createElement("div");
        document.body.append(text);
        expect(typingInto(text)).toBe(false);
    });
});
