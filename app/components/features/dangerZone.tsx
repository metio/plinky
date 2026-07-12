// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { useStore } from "../../contexts/services";
import { PREFIX, resetDevice } from "../../lib/resetDevice";
import { m } from "../../paraglide/messages.js";
import { ConfirmButton } from "../ui/confirmButton";
import { TrashIcon } from "../ui/icons";
import { SettingsSection } from "../ui/settingsSection";

// Erase all of this device's Plinky data and start fresh. Destructive and
// irreversible, so it sits behind the app-wide two-click ConfirmButton; the copy
// points at the Library backup for anyone who wants to keep their scores first.
export function DangerZone() {
    const store = useStore();
    const [failed, setFailed] = useState(false);

    const reset = () => {
        resetDevice(store);
        // A refused removal leaves Plinky keys behind. Reloading would hide that the
        // wipe never took, so report it and let the player try again instead.
        if (store.keys().some((key) => key.startsWith(PREFIX))) {
            setFailed(true);
            return;
        }
        window.location.reload();
    };

    return (
        <SettingsSection
            title={m.settings_danger_heading()}
            hint={m.settings_reset_help()}
            icon={<TrashIcon className="h-5 w-5" />}
            tone="danger"
        >
            <ConfirmButton variant="danger" confirmLabel={m.settings_reset_yes()} onConfirm={reset}>
                {m.settings_reset()}
            </ConfirmButton>
            {failed && (
                <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
                    {m.settings_reset_failed()}
                </p>
            )}
        </SettingsSection>
    );
}
