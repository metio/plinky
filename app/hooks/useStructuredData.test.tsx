// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useStructuredData } from "./useStructuredData";

function Page({ type, data }: { type: string; data: Record<string, unknown> | null }) {
    useStructuredData(type, data);
    return null;
}

const block = (data: unknown) => {
    const tag = document.createElement("script");
    tag.setAttribute("type", "application/ld+json");
    tag.textContent = JSON.stringify(data);
    document.head.append(tag);
    return tag;
};

const blocks = () =>
    [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((tag) =>
        JSON.parse(tag.textContent ?? "null"),
    );

afterEach(() => {
    cleanup();
    document.head.replaceChildren();
});

describe("useStructuredData", () => {
    it("fills in the block the document was served with", () => {
        block({ "@type": "Person", name: "Chopin" });
        render(
            <Page type="Person" data={{ "@type": "Person", name: "Chopin", birthDate: "1810" }} />,
        );
        expect(blocks()).toEqual([{ "@type": "Person", name: "Chopin", birthDate: "1810" }]);
    });

    it("leaves the page's other blocks alone", () => {
        block({ "@type": "BreadcrumbList", itemListElement: [] });
        block({ "@type": "Person", name: "Chopin" });
        render(<Page type="Person" data={{ "@type": "Person", name: "Frédéric Chopin" }} />);
        expect(blocks()).toEqual([
            { "@type": "BreadcrumbList", itemListElement: [] },
            { "@type": "Person", name: "Frédéric Chopin" },
        ]);
    });

    it("writes one where the document had none", () => {
        render(<Page type="Person" data={{ "@type": "Person", name: "Chopin" }} />);
        expect(blocks()).toEqual([{ "@type": "Person", name: "Chopin" }]);
    });

    it("writes nothing while the subject is unknown", () => {
        render(<Page type="Person" data={null} />);
        expect(blocks()).toEqual([]);
    });

    it("rewrites nothing when the data has not changed", () => {
        const { rerender } = render(<Page type="Person" data={{ "@type": "Person", name: "A" }} />);
        const tag = document.head.querySelector('script[type="application/ld+json"]');
        rerender(<Page type="Person" data={{ "@type": "Person", name: "A" }} />);
        expect(document.head.querySelector('script[type="application/ld+json"]')).toBe(tag);
        expect(blocks()).toHaveLength(1);
    });

    it("ignores a block that is not JSON", () => {
        const broken = document.createElement("script");
        broken.setAttribute("type", "application/ld+json");
        broken.textContent = "not json";
        document.head.append(broken);
        render(<Page type="Person" data={{ "@type": "Person", name: "Chopin" }} />);
        expect(document.head.querySelectorAll('script[type="application/ld+json"]').length).toBe(2);
    });
});
