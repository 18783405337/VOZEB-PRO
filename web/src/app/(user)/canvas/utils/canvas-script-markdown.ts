/**
 * Canvas Script Markdown Utilities
 *
 * 处理 Tiptap JSON 与 Markdown 之间的转换
 */

/**
 * 计算文本统计信息
 */
export function calculateTextStats(plainText: string): {
    characterCount: number;
    wordCount: number;
} {
    const characterCount = plainText.length;
    const wordCount = plainText
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length;

    return { characterCount, wordCount };
}

/**
 * 从 Tiptap JSON 提取纯文本
 */
export function extractPlainText(content: any): string {
    if (!content || !content.content) return "";

    let text = "";

    function traverse(node: any) {
        if (node.type === "text") {
            text += node.text || "";
        }

        if (node.content && Array.isArray(node.content)) {
            for (const child of node.content) {
                traverse(child);
            }
        }

        // 在段落和标题后添加空格
        if (node.type === "paragraph" || node.type === "heading") {
            text += " ";
        }
    }

    traverse(content);

    return text.trim();
}

/**
 * 基础 Tiptap JSON 转 Markdown
 * 注意：这是简化版本，实际使用中建议使用 @tiptap/extension-markdown
 */
export function tiptapToMarkdown(content: any): string {
    if (!content || !content.content) return "";

    let markdown = "";

    function traverse(node: any, depth = 0): string {
        let result = "";

        switch (node.type) {
            case "doc":
                if (node.content) {
                    result = node.content.map((child: any) => traverse(child, depth)).join("");
                }
                break;

            case "paragraph":
                if (node.content) {
                    result = node.content.map((child: any) => traverse(child, depth)).join("") + "\n\n";
                } else {
                    result = "\n";
                }
                break;

            case "heading":
                const level = node.attrs?.level || 1;
                const headingPrefix = "#".repeat(level);
                const headingText = node.content
                    ? node.content.map((child: any) => traverse(child, depth)).join("")
                    : "";
                result = `${headingPrefix} ${headingText}\n\n`;
                break;

            case "text":
                let text = node.text || "";

                // 应用标记
                if (node.marks) {
                    for (const mark of node.marks) {
                        switch (mark.type) {
                            case "bold":
                                text = `**${text}**`;
                                break;
                            case "italic":
                                text = `*${text}*`;
                                break;
                            case "code":
                                text = `\`${text}\``;
                                break;
                            case "strike":
                                text = `~~${text}~~`;
                                break;
                            case "link":
                                const href = mark.attrs?.href || "";
                                text = `[${text}](${href})`;
                                break;
                        }
                    }
                }
                result = text;
                break;

            case "codeBlock":
                const language = node.attrs?.language || "";
                const code = node.content
                    ? node.content.map((child: any) => traverse(child, depth)).join("")
                    : "";
                result = `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
                break;

            case "bulletList":
                if (node.content) {
                    result = node.content.map((child: any) => traverse(child, depth)).join("") + "\n";
                }
                break;

            case "orderedList":
                if (node.content) {
                    result = node.content
                        .map((child: any, index: number) => traverse(child, depth, index + 1))
                        .join("") + "\n";
                }
                break;

            case "listItem":
                const prefix = typeof depth === "number" && depth > 0 ? `${depth}. ` : "- ";
                const itemText = node.content
                    ? node.content.map((child: any) => traverse(child, depth)).join("")
                    : "";
                result = `${prefix}${itemText}`;
                break;

            case "blockquote":
                if (node.content) {
                    const quoteText = node.content
                        .map((child: any) => traverse(child, depth))
                        .join("")
                        .split("\n")
                        .map((line: string) => `> ${line}`)
                        .join("\n");
                    result = `${quoteText}\n\n`;
                }
                break;

            case "hardBreak":
                result = "  \n";
                break;

            case "horizontalRule":
                result = "---\n\n";
                break;

            default:
                // 未知节点类型，尝试处理子节点
                if (node.content) {
                    result = node.content.map((child: any) => traverse(child, depth)).join("");
                }
        }

        return result;
    }

    markdown = traverse(content);
    return markdown.trim();
}

/**
 * 验证 Tiptap JSON 内容
 */
export function validateTiptapContent(content: any): boolean {
    if (!content || typeof content !== "object") return false;
    if (content.type !== "doc") return false;
    if (!Array.isArray(content.content)) return false;
    return true;
}

/**
 * 创建空的 Tiptap 文档
 */
export function createEmptyTiptapDocument(): any {
    return {
        type: "doc",
        content: [
            {
                type: "paragraph",
                content: [],
            },
        ],
    };
}
