"use client";

import { useState, useCallback } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "antd";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterAsset } from "../../character-types";
import { CharacterPreviewCard } from "./character-preview-card";

type CharacterSortableGridProps = {
    characters: CharacterAsset[];
    onReorder?: (characters: CharacterAsset[]) => void;
    onCharacterClick?: (character: CharacterAsset) => void;
    disabled?: boolean;
    className?: string;
};

export function CharacterSortableGrid({
    characters,
    onReorder,
    onCharacterClick,
    disabled = false,
    className,
}: CharacterSortableGridProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        const oldIndex = characters.findIndex((c) => c.id === active.id);
        const newIndex = characters.findIndex((c) => c.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = arrayMove(characters, oldIndex, newIndex);
            onReorder?.(reordered);
        }
    };

    const activeCharacter = characters.find((c) => c.id === activeId);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={characters.map((c) => c.id)} strategy={rectSortingStrategy}>
                <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", className)}>
                    {characters.map((character) => (
                        <SortableCharacterCard
                            key={character.id}
                            character={character}
                            onClick={() => onCharacterClick?.(character)}
                            disabled={disabled}
                        />
                    ))}
                </div>
            </SortableContext>

            <DragOverlay>
                {activeCharacter && (
                    <div className="rotate-3 opacity-90">
                        <CharacterPreviewCard character={activeCharacter} size="medium" showActions={false} />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}

type SortableCharacterCardProps = {
    character: CharacterAsset;
    onClick?: () => void;
    disabled?: boolean;
};

function SortableCharacterCard({ character, onClick, disabled }: SortableCharacterCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: character.id,
        disabled,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative">
            {!disabled && (
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute left-2 top-2 z-10 cursor-grab rounded bg-white/90 p-1 shadow-sm backdrop-blur-sm transition hover:bg-white active:cursor-grabbing dark:bg-stone-800/90 dark:hover:bg-stone-800"
                >
                    <GripVertical className="size-4 text-stone-500" />
                </div>
            )}
            <CharacterPreviewCard
                character={character}
                size="medium"
                showActions={true}
                onClick={onClick}
            />
        </div>
    );
}
