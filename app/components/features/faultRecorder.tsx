// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { useServices } from "../../contexts/services";

// Writes down faults the page never got to handle.
//
// Renders nothing: it exists to hold one subscription for as long as the app is
// mounted. It sits inside the services provider because that is where the feed and the
// log are injected from — the browser's error events are reached through the ErrorFeed
// adapter rather than from here, so this stays testable against a fake that emits
// faults on demand.
//
// A fault that arrives while the log itself cannot be written is lost, which is the
// right order of priorities: the recorder must never be the thing that throws.
export function FaultRecorder() {
    const { errorFeed, errors } = useServices();
    useEffect(
        () =>
            errorFeed.subscribe((fault) => {
                try {
                    errors.record({ ...fault, at: Date.now() });
                } catch {
                    // Recording a fault must not raise one. A storage that refuses
                    // already reports through the write verdict; a storage that throws
                    // outright would otherwise turn one broken feature into a loop.
                }
            }),
        [errorFeed, errors],
    );
    return null;
}
