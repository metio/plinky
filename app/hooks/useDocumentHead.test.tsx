// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDocumentHead } from "./useDocumentHead";

function Page({ headline, description }: { headline: string | null; description: string | null }) {
    useDocumentHead(headline, description);
    return null;
}

const meta = (attribute: string, value: string, content: string) => {
    const tag = document.createElement("meta");
    tag.setAttribute(attribute, value);
    tag.setAttribute("content", content);
    document.head.append(tag);
    return tag;
};

afterEach(() => {
    cleanup();
    document.head.replaceChildren();
    document.title = "";
});

describe("useDocumentHead", () => {
    it("writes the title and the descriptions once the subject is known", () => {
        document.title = "Play · Plinky";
        const description = meta("name", "description", "Play a piece");
        const ogTitle = meta("property", "og:title", "Play");
        const twitter = meta("name", "twitter:description", "Play a piece");

        render(<Page headline="Ode to Joy" description="Play Ode to Joy by Beethoven" />);

        expect(document.title).toBe("Ode to Joy · Plinky");
        expect(description.getAttribute("content")).toBe("Play Ode to Joy by Beethoven");
        expect(ogTitle.getAttribute("content")).toBe("Ode to Joy");
        expect(twitter.getAttribute("content")).toBe("Play Ode to Joy by Beethoven");
    });

    it("leaves the head alone while the subject is still unknown", () => {
        document.title = "Play · Plinky";
        const description = meta("name", "description", "Play a piece");
        render(<Page headline={null} description={null} />);
        expect(document.title).toBe("Play · Plinky");
        expect(description.getAttribute("content")).toBe("Play a piece");
    });

    it("writes the tags a page reached by navigating never had", () => {
        render(<Page headline="Ode to Joy" description="Play Ode to Joy" />);
        expect(
            document.head.querySelector('meta[name="description"]')?.getAttribute("content"),
        ).toBe("Play Ode to Joy");
        expect(
            document.head.querySelector('meta[property="og:title"]')?.getAttribute("content"),
        ).toBe("Ode to Joy");
        expect(document.head.querySelectorAll("meta").length).toBe(5);
    });

    it("keeps a description it was not given", () => {
        const description = meta("name", "description", "Play a piece");
        render(<Page headline="Ode to Joy" description={null} />);
        expect(document.title).toBe("Ode to Joy · Plinky");
        expect(description.getAttribute("content")).toBe("Play a piece");
    });
});
