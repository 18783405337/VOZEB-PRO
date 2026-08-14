"use client";

import React, { useState, useCallback } from "react";
import { X, Plus, Search, Filter, Wand2 } from "lucide-react";
import type { SkillTemplate, SkillCategory } from "../skill-types";
import { BUILTIN_SKILL_TEMPLATES, getSkillCategoryLabel } from "../skill-types";

type SkillTemplateSelectorProps = {
    onSelect: (template: SkillTemplate) => void;
    onClose: () => void;
};

/**
 * 技能模板选择器
 * 显示内置和自定义技能模板供用户选择
 */
export function SkillTemplateSelector({ onSelect, onClose }: SkillTemplateSelectorProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<SkillCategory | "all">("all");

    const categories: Array<SkillCategory | "all"> = [
        "all",
        "image-processing",
        "video-editing",
        "audio-processing",
        "text-generation",
        "data-analysis",
        "automation",
        "custom",
    ];

    const filteredTemplates = BUILTIN_SKILL_TEMPLATES.filter((template) => {
        const matchesSearch =
            !searchQuery ||
            template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
                {/* 头部 */}
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">选择技能模板</h2>
                        <p className="mt-1 text-sm text-gray-500">从预设模板快速创建技能节点</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                {/* 搜索和筛选 */}
                <div className="border-b border-gray-200 p-4">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索技能..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as SkillCategory | "all")}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="all">全部分类</option>
                            {categories.slice(1).map((category) => (
                                <option key={category} value={category}>
                                    {getSkillCategoryLabel(category as SkillCategory)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 模板列表 */}
                <div className="thin-scrollbar max-h-[500px] overflow-y-auto p-4">
                    {filteredTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Wand2 className="mb-3 size-12 opacity-30" />
                            <p className="text-sm">未找到匹配的技能模板</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredTemplates.map((template) => (
                                <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => onSelect(template)}
                                    className="group rounded-lg border border-gray-200 p-4 text-left transition hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-md"
                                >
                                    <div className="mb-2 flex items-start justify-between">
                                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                                            <Wand2 className="size-5" />
                                        </div>
                                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                                            {getSkillCategoryLabel(template.category)}
                                        </span>
                                    </div>
                                    <h3 className="mb-1 font-medium text-gray-900 group-hover:text-blue-700">
                                        {template.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 line-clamp-2">{template.description}</p>
                                    <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                                        <span>{template.parameters.length} 个参数</span>
                                        <span>•</span>
                                        <span>{template.builtin ? "内置" : "自定义"}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 底部提示 */}
                <div className="border-t border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-500">
                    选择一个模板后，可以在节点中配置参数并执行技能
                </div>
            </div>
        </div>
    );
}
