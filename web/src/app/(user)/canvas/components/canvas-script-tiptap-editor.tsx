"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CharacterCount from "@tiptap/extension-character-count";
import { useEffect } from "react";

type TiptapEditorProps = {
    content: any;
    onChange?: (content: any, editor: Editor) => void;
    onUpdate?: (stats: { characterCount: number; wordCount: number }) => void;
    placeholder?: string;
    readOnly?: boolean;
    characterLimit?: number;
    className?: string;
};

/**
 * Tiptap 富文本编辑器组件
 */
export function TiptapEditor({
    content,
    onChange,
    onUpdate,
    placeholder = "开始写作...",
    readOnly = false,
    characterLimit,
    className = "",
}: TiptapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                history: {
                    depth: 100,
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-blue-500 underline hover:text-blue-600",
                },
            }),
            Highlight.configure({
                multicolor: false,
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            CharacterCount.configure({
                limit: characterLimit,
            }),
        ],
        content,
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            const json = editor.getJSON();
            onChange?.(json, editor);

            const stats = {
                characterCount: editor.storage.characterCount.characters(),
                wordCount: editor.storage.characterCount.words(),
            };
            onUpdate?.(stats);
        },
        editorProps: {
            attributes: {
                class: `prose prose-sm max-w-none focus:outline-none ${className}`,
            },
        },
    });

    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            editor.setEditable(!readOnly);
        }
    }, [readOnly, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="tiptap-editor-wrapper h-full flex flex-col">
            <EditorContent editor={editor} className="flex-1 overflow-auto p-4" />
        </div>
    );
}
