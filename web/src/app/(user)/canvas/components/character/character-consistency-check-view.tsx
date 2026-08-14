"use client";

import React from "react";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import type { CharacterConsistencyCheckResponse } from "../../character-reference-types";

type CharacterConsistencyCheckViewProps = {
    result: CharacterConsistencyCheckResponse;
    onShotClick?: (shotId: string) => void;
};

/**
 * 角色一致性检查结果视图
 * 显示角色在多个镜头中的一致性检查结果
 */
export function CharacterConsistencyCheckView({
    result,
    onShotClick,
}: CharacterConsistencyCheckViewProps) {
    // 计算通过率
    const passedChecks = result.checks.filter(c => c.passed).length;
    const passRate = result.checks.length > 0
        ? (passedChecks / result.checks.length) * 100
        : 0;

    // 获取得分等级
    const getScoreGrade = (score: number) => {
        if (score >= 90) return { label: "优秀", color: "green" };
        if (score >= 75) return { label: "良好", color: "blue" };
        if (score >= 60) return { label: "一般", color: "yellow" };
        return { label: "较差", color: "red" };
    };

    const overallGrade = getScoreGrade(result.overallScore);

    return (
        <div className="space-y-4">
            {/* 总体得分 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium text-gray-700">
                            总体一致性得分
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                            通过率: {passRate.toFixed(1)}% ({passedChecks}/{result.checks.length})
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-gray-900">
                            {result.overallScore.toFixed(0)}
                        </div>
                        <div
                            className={`mt-1 inline-block rounded px-2 py-0.5 text-xs text-white ${
                                overallGrade.color === "green"
                                    ? "bg-green-500"
                                    : overallGrade.color === "blue"
                                      ? "bg-blue-500"
                                      : overallGrade.color === "yellow"
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                            }`}
                        >
                            {overallGrade.label}
                        </div>
                    </div>
                </div>

                {/* 得分进度条 */}
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                        className={`h-full transition-all ${
                            overallGrade.color === "green"
                                ? "bg-green-500"
                                : overallGrade.color === "blue"
                                  ? "bg-blue-500"
                                  : overallGrade.color === "yellow"
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                        }`}
                        style={{ width: `${result.overallScore}%` }}
                    />
                </div>
            </div>

            {/* 各镜头检查结果 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                    镜头检查详情 ({result.checks.length})
                </h3>
                <div className="space-y-2">
                    {result.checks.map((check) => {
                        const grade = getScoreGrade(check.score);

                        return (
                            <button
                                key={check.shotId}
                                type="button"
                                onClick={() => onShotClick?.(check.shotId)}
                                className="flex w-full items-center gap-3 rounded-lg border border-gray-100 p-3 text-left hover:bg-gray-50"
                            >
                                {/* 状态图标 */}
                                <div>
                                    {check.passed ? (
                                        <CheckCircle className="size-5 text-green-500" />
                                    ) : (
                                        <XCircle className="size-5 text-red-500" />
                                    )}
                                </div>

                                {/* 镜头信息 */}
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-gray-700">
                                        镜头 {check.shotId.slice(0, 8)}...
                                    </div>
                                    {check.issues && check.issues.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {check.issues.map((issue, idx) => (
                                                <span
                                                    key={idx}
                                                    className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700"
                                                >
                                                    {issue}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 得分 */}
                                <div className="text-right">
                                    <div className="text-lg font-bold text-gray-900">
                                        {check.score.toFixed(0)}
                                    </div>
                                    <div
                                        className={`mt-0.5 text-xs ${
                                            grade.color === "green"
                                                ? "text-green-600"
                                                : grade.color === "blue"
                                                  ? "text-blue-600"
                                                  : grade.color === "yellow"
                                                    ? "text-yellow-600"
                                                    : "text-red-600"
                                        }`}
                                    >
                                        {grade.label}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 建议 */}
            {result.checks.some(c => !c.passed) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="size-5 text-amber-600" />
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-amber-900">
                                改进建议
                            </h4>
                            <ul className="mt-2 space-y-1 text-xs text-amber-800">
                                <li>• 确保角色的视觉描述在所有镜头中保持一致</li>
                                <li>• 检查参考图片的质量和清晰度</li>
                                <li>• 考虑为不同角色使用不同的视觉风格标签</li>
                                <li>• 使用外观备注说明特定镜头中的变化</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
