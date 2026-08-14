"use client";

import { useState } from "react";
import { Modal, Button, Tabs } from "antd";
import { Users } from "lucide-react";
import type { CharacterAsset } from "../../character-types";
import { CharacterAssetLibrary } from "./character-asset-library";

type CharacterSelectorProps = {
    open: boolean;
    mode?: "single" | "multiple";
    selectedIds?: string[];
    onSelect?: (characters: CharacterAsset[]) => void;
    onCancel?: () => void;
};

export function CharacterSelector({ open, mode = "single", selectedIds = [], onSelect, onCancel }: CharacterSelectorProps) {
    const [selected, setSelected] = useState<string[]>(selectedIds);
    const [tempSelected, setTempSelected] = useState<CharacterAsset[]>([]);

    const handleConfirm = () => {
        onSelect?.(tempSelected);
    };

    const handleSingleSelect = (character: CharacterAsset) => {
        onSelect?.([character]);
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <Users className="size-5" />
                    <span>选择角色</span>
                </div>
            }
            open={open}
            onCancel={onCancel}
            footer={
                mode === "multiple" ? (
                    <div className="flex justify-end gap-2">
                        <Button onClick={onCancel}>取消</Button>
                        <Button type="primary" onClick={handleConfirm} disabled={tempSelected.length === 0}>
                            确定选择 ({tempSelected.length})
                        </Button>
                    </div>
                ) : null
            }
            width={1000}
            styles={{ body: { height: "70vh", padding: 0 } }}
            destroyOnClose
        >
            <CharacterAssetLibrary
                open={open}
                selectedIds={selected}
                selectionMode={mode}
                onSelect={mode === "single" ? handleSingleSelect : undefined}
                onSelectionChange={mode === "multiple" ? setSelected : undefined}
            />
        </Modal>
    );
}
