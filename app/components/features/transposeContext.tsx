// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { createContext, type Dispatch, type SetStateAction, useContext } from "react";

// The play page's transposition is a page-scoped option, shared by the score the
// ScoreViewer renders and the Print / Export buttons on the title line so all three
// act on the same key. Where no provider is mounted (daily, review) the viewer keeps
// its own local transpose state instead. The setter mirrors useState so the viewer
// can fall back to a local one with the same shape.
export type TransposeValue = {
    transpose: number;
    setTranspose: Dispatch<SetStateAction<number>>;
};

const TransposeContext = createContext<TransposeValue | null>(null);

export const TransposeProvider = TransposeContext.Provider;

export function useTranspose(): TransposeValue | null {
    return useContext(TransposeContext);
}
