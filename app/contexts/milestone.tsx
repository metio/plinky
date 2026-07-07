// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Milestone } from "../../core/milestones";

// The earned-moment channel: a run completing anywhere (play, review, sprint, the daily
// challenge) publishes its milestone here, and the app shell's single banner subscribes
// and celebrates it. Transient by design — an earned moment is shown once then dismissed,
// never persisted — so it lives in a scoped provider, not a storage-backed store.
export type MilestoneChannel = {
    current: Milestone | null;
    publish: (milestone: Milestone) => void;
    dismiss: () => void;
};

// Outside a provider, publishing is a no-op: the app shell always mounts one, so a run
// completed in the real app is celebrated, while a ScoreViewer mounted bare in a test or
// story stays mountable without wiring a provider it doesn't assert on.
const NOOP: MilestoneChannel = { current: null, publish: () => {}, dismiss: () => {} };

const MilestoneContext = createContext<MilestoneChannel | null>(null);

export function MilestoneProvider({ children }: { children: ReactNode }) {
    const [current, setCurrent] = useState<Milestone | null>(null);
    const publish = useCallback((milestone: Milestone) => setCurrent(milestone), []);
    const dismiss = useCallback(() => setCurrent(null), []);
    const value = useMemo(() => ({ current, publish, dismiss }), [current, publish, dismiss]);
    return <MilestoneContext.Provider value={value}>{children}</MilestoneContext.Provider>;
}

export function useMilestoneChannel(): MilestoneChannel {
    return useContext(MilestoneContext) ?? NOOP;
}
