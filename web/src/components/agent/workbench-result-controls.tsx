"use client";

import type { RefObject } from "react";
import { Check } from "lucide-react";

export function WorkbenchFileInput({ inputRef, accept, onFiles }: { inputRef: RefObject<HTMLInputElement | null>; accept: string; onFiles: (files: FileList | null) => void }) {
    return (
        <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            className="hidden"
            onChange={(event) => {
                onFiles(event.target.files);
                event.target.value = "";
            }}
        />
    );
}

export function ResultSelectCheckbox({ selected, onSelectedChange }: { selected?: boolean; onSelectedChange?: (checked: boolean) => void }) {
    if (!onSelectedChange) return null;
    return (
        <button
            type="button"
            aria-label="选择生成结果"
            aria-pressed={Boolean(selected)}
            className={"glass-interactive glass-focus-ring absolute left-2 top-2 z-10 inline-flex size-6 items-center justify-center rounded-lg " + (selected ? "glass-surface-strong text-stone-950 dark:text-white" : "glass-surface-muted text-stone-700 hover:text-stone-950 dark:text-white")}
            onClick={(event) => {
                event.stopPropagation();
                onSelectedChange(!selected);
            }}
        >
            {selected ? <Check className="size-3.5 stroke-[3]" /> : null}
        </button>
    );
}
