// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Mirrors app/components/ui/confirmButton.stories.tsx. Owned rather than generated
// because Armed reaches its state through a story `play` function — one click on the
// resting trigger — and the generated wrapper composes args only, so the preview showed
// the resting button where storybook shows the red confirm + cancel pair. The armed
// state has no prop: the click is the only way in, so the preview performs it on mount.
import { useEffect, useRef, useState } from "react";
import { CloseIcon, ConfirmButton } from "plinky";

const noop = () => {};

export const AtRest = () => (
    <ConfirmButton
        onConfirm={noop}
        confirmLabel="Delete everything?"
        variant="danger"
    >
        Delete everything
    </ConfirmButton>
);

export const Armed = () => {
    const host = useRef<HTMLDivElement>(null);
    const [armed, setArmed] = useState(false);
    useEffect(() => {
        if (armed) return;
        host.current?.querySelector("button")?.click();
        setArmed(true);
    }, [armed]);
    // display:contents keeps the trigger's own box the only one in the layout, so the
    // wrapper the click needs cannot move the component relative to the story render.
    return (
        <div ref={host} style={{ display: "contents" }}>
            <ConfirmButton
                onConfirm={noop}
                confirmLabel="Delete everything?"
                variant="danger"
            >
                Delete everything
            </ConfirmButton>
        </div>
    );
};

export const IconTrigger = () => (
    <ConfirmButton
        onConfirm={noop}
        confirmLabel="Remove take?"
        label="Remove take"
        variant="ghost"
    >
        <CloseIcon />
    </ConfirmButton>
);
