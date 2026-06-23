import {useEffect, useRef} from "react";
import abcjs, {type TuneObject} from "abcjs";

export function AbcRenderer({
    abcTune,
    onRender,
}: {
    abcTune: string;
    onRender?: (tune: TuneObject) => void;
}) {
    const abcElement = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!abcElement.current) {
            return;
        }
        const tunes = abcjs.renderAbc(abcElement.current, abcTune, {
            add_classes: true,
            responsive: "resize",
        });
        if (tunes[0]) {
            onRender?.(tunes[0]);
        }
    }, [abcTune, onRender]);

    return <div ref={abcElement} />;
}
