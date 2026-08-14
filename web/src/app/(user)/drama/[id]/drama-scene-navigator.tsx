"use client";

import { Badge, Button, Card, Collapse, Empty, Input, Select, Space, Statistic } from "antd";
import { Filter, Layers, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { SceneGroup } from "@/lib/drama-scene-types";
import { calculateSceneStatistics, filterScenesBySearch, sceneColorMap, sortScenesByOrder } from "@/lib/drama-scene-utils";
import type { DramaShot } from "@/lib/drama-project-contract";

interface DramaSceneNavigatorProps {
    sceneGroups: SceneGroup[];
    shots: DramaShot[];
    activeSceneId?: string;
    onSceneClick: (sceneId: string) => void;
    onClose?: () => void;
}

export function DramaSceneNavigator({ sceneGroups, shots, activeSceneId, onSceneClick, onClose }: DramaSceneNavigatorProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterLocation, setFilterLocation] = useState<string | undefined>();
    const [filterTimeOfDay, setFilterTimeOfDay] = useState<string | undefined>();

    const statistics = useMemo(() => calculateSceneStatistics(sceneGroups, shots), [sceneGroups, shots]);

    const filteredScenes = useMemo(() => {
        let filtered = filterScenesBySearch(sceneGroups, searchTerm);

        if (filterLocation) {
            filtered = filtered.filter((scene) => scene.location === filterLocation);
        }

        if (filterTimeOfDay) {
            filtered = filtered.filter((scene) => scene.timeOfDay === filterTimeOfDay);
        }

        return sortScenesByOrder(filtered);
    }, [sceneGroups, searchTerm, filterLocation, filterTimeOfDay]);

    const locationOptions = useMemo(
        () =>
            Object.keys(statistics.scenesByLocation).map((location) => ({
                label: `${location} (${statistics.scenesByLocation[location]})`,
                value: location,
            })),
        [statistics.scenesByLocation]
    );

    const timeOfDayOptions = useMemo(
        () =>
            Object.keys(statistics.scenesByTimeOfDay).map((time) => ({
                label: `${time} (${statistics.scenesByTimeOfDay[time]})`,
                value: time,
            })),
        [statistics.scenesByTimeOfDay]
    );

    const hasActiveFilters = Boolean(searchTerm || filterLocation || filterTimeOfDay);

    const clearFilters = () => {
        setSearchTerm("");
        setFilterLocation(undefined);
        setFilterTimeOfDay(undefined);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Layers className="size-5" />
                        <h3 className="font-semibold text-base mb-0">场景导航</h3>
                    </div>
                    {onClose && (
                        <Button type="text" size="small" icon={<X className="size-4" />} onClick={onClose} />
                    )}
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <Card size="small" className="text-center">
                        <Statistic title="场景数" value={statistics.totalScenes} valueStyle={{ fontSize: 20 }} />
                    </Card>
                    <Card size="small" className="text-center">
                        <Statistic title="镜头数" value={statistics.totalShots} valueStyle={{ fontSize: 20 }} />
                    </Card>
                    <Card size="small" className="text-center">
                        <Statistic title="总时长" value={statistics.totalDuration} suffix="s" valueStyle={{ fontSize: 20 }} />
                    </Card>
                </div>

                {/* Search */}
                <Input
                    placeholder="搜索场景名称、描述..."
                    prefix={<Search className="size-4 text-muted-foreground" />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                    className="mb-2"
                />

                {/* Filters */}
                <Collapse
                    ghost
                    size="small"
                    items={[
                        {
                            key: "filters",
                            label: (
                                <div className="flex items-center gap-2">
                                    <Filter className="size-3.5" />
                                    <span className="text-xs">筛选条件</span>
                                    {hasActiveFilters && <Badge status="processing" />}
                                </div>
                            ),
                            children: (
                                <Space direction="vertical" className="w-full" size="small">
                                    <Select
                                        placeholder="按地点筛选"
                                        options={locationOptions}
                                        value={filterLocation}
                                        onChange={setFilterLocation}
                                        allowClear
                                        className="w-full"
                                        size="small"
                                    />
                                    <Select
                                        placeholder="按时段筛选"
                                        options={timeOfDayOptions}
                                        value={filterTimeOfDay}
                                        onChange={setFilterTimeOfDay}
                                        allowClear
                                        className="w-full"
                                        size="small"
                                    />
                                    {hasActiveFilters && (
                                        <Button size="small" onClick={clearFilters} block>
                                            清除筛选
                                        </Button>
                                    )}
                                </Space>
                            ),
                        },
                    ]}
                />
            </div>

            {/* Scene List */}
            <div className="flex-1 overflow-y-auto p-4">
                {filteredScenes.length === 0 ? (
                    <Empty description={hasActiveFilters ? "没有匹配的场景" : "暂无场景"} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    <div className="space-y-2">
                        {filteredScenes.map((scene) => {
                            const sceneShots = shots.filter((shot) => scene.shotIds.includes(shot.id));
                            const colorStyles = sceneColorMap[scene.color];
                            const isActive = scene.id === activeSceneId;
                            const sceneDuration = sceneShots.reduce((sum, shot) => sum + shot.duration, 0);
                            const completedCount = sceneShots.filter((shot) => shot.generationStatus === "success").length;

                            return (
                                <Card
                                    key={scene.id}
                                    size="small"
                                    className={`cursor-pointer border-l-4 ${colorStyles.border} transition-all hover:shadow-md ${
                                        isActive ? "ring-2 ring-primary/50 shadow-md" : ""
                                    }`}
                                    onClick={() => onSceneClick(scene.id)}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm mb-1 truncate">{scene.name}</div>
                                            {scene.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                                    {scene.description}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-1">
                                                {scene.location && (
                                                    <Badge count={scene.location} showZero={false} style={{ backgroundColor: "#52c41a" }} />
                                                )}
                                                {scene.timeOfDay && (
                                                    <Badge count={scene.timeOfDay} showZero={false} style={{ backgroundColor: "#1890ff" }} />
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs text-muted-foreground mb-1">
                                                {sceneShots.length} 镜头
                                            </div>
                                            <div className="text-xs text-muted-foreground mb-1">
                                                {sceneDuration}s
                                            </div>
                                            {completedCount > 0 && (
                                                <Badge
                                                    count={`${completedCount}/${sceneShots.length}`}
                                                    style={{ backgroundColor: "#52c41a" }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
