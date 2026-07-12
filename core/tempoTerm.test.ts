// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { tempoTerm } from "./tempoTerm";

describe("tempoTerm", () => {
    it("names the conventional metronome ranges", () => {
        expect(tempoTerm(30)).toBe("Grave");
        expect(tempoTerm(50)).toBe("Largo");
        expect(tempoTerm(70)).toBe("Adagio");
        expect(tempoTerm(90)).toBe("Andante");
        expect(tempoTerm(112)).toBe("Moderato");
        expect(tempoTerm(120)).toBe("Allegro");
        expect(tempoTerm(160)).toBe("Vivace");
        expect(tempoTerm(200)).toBe("Presto");
    });

    it("treats each boundary as the start of the faster term", () => {
        expect(tempoTerm(59)).toBe("Largo");
        expect(tempoTerm(60)).toBe("Adagio");
        expect(tempoTerm(155)).toBe("Allegro");
        expect(tempoTerm(156)).toBe("Vivace");
    });
});
