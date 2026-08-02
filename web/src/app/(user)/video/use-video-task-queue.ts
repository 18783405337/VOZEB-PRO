"use client";

import { useCallback, useRef, useState } from "react";

import type { AiConfig } from "@/stores/use-config-store";
import type { GenerationLog } from "./video-workbench-records";

type VideoTaskRunner = (log: GenerationLog, configOverride?: AiConfig) => void | Promise<void>;

export function useVideoTaskQueue({ blockedLogIdsRef, runLog }: { blockedLogIdsRef: { current: Set<string> }; runLog: VideoTaskRunner }) {
    const activeLogIdsRef = useRef(new Set<string>());
    const startingTasksRef = useRef(0);
    const queuedLogsRef = useRef<Array<{ log: GenerationLog; configOverride?: AiConfig }>>([]);
    const queuedLogIdsRef = useRef(new Set<string>());
    const concurrencyLimitRef = useRef(1);
    const runnerRef = useRef(runLog);
    const [activeVideoCount, setActiveVideoCount] = useState(0);
    runnerRef.current = runLog;

    const currentTaskCount = useCallback(() => activeLogIdsRef.current.size + startingTasksRef.current, []);
    const syncActiveCount = useCallback(() => setActiveVideoCount(currentTaskCount()), [currentTaskCount]);

    const enqueue = useCallback(
        (log: GenerationLog, configOverride?: AiConfig) => {
            if (!log.task || activeLogIdsRef.current.has(log.id) || queuedLogIdsRef.current.has(log.id) || blockedLogIdsRef.current.has(log.id)) return;
            queuedLogIdsRef.current.add(log.id);
            queuedLogsRef.current.push({ log, configOverride });
        },
        [blockedLogIdsRef],
    );

    const drain = useCallback(() => {
        while (currentTaskCount() < concurrencyLimitRef.current && queuedLogsRef.current.length) {
            const item = queuedLogsRef.current.shift();
            if (!item) break;
            queuedLogIdsRef.current.delete(item.log.id);
            if (blockedLogIdsRef.current.has(item.log.id)) continue;
            void runnerRef.current(item.log, item.configOverride);
        }
        syncActiveCount();
    }, [blockedLogIdsRef, currentTaskCount, syncActiveCount]);

    const schedule = useCallback(
        (log: GenerationLog, configOverride?: AiConfig) => {
            if (!log.task || activeLogIdsRef.current.has(log.id) || blockedLogIdsRef.current.has(log.id)) return;
            if (currentTaskCount() >= concurrencyLimitRef.current) {
                enqueue(log, configOverride);
                syncActiveCount();
                return;
            }
            void runnerRef.current(log, configOverride);
        },
        [blockedLogIdsRef, currentTaskCount, enqueue, syncActiveCount],
    );

    const claim = useCallback(
        (log: GenerationLog, configOverride?: AiConfig) => {
            if (!log.task || activeLogIdsRef.current.has(log.id) || blockedLogIdsRef.current.has(log.id)) return false;
            if (currentTaskCount() >= concurrencyLimitRef.current) {
                enqueue(log, configOverride);
                syncActiveCount();
                return false;
            }
            activeLogIdsRef.current.add(log.id);
            syncActiveCount();
            return true;
        },
        [blockedLogIdsRef, currentTaskCount, enqueue, syncActiveCount],
    );

    const finish = useCallback(
        (logId: string) => {
            activeLogIdsRef.current.delete(logId);
            syncActiveCount();
            drain();
        },
        [drain, syncActiveCount],
    );

    const removeQueued = useCallback((logId: string) => {
        queuedLogIdsRef.current.delete(logId);
        queuedLogsRef.current = queuedLogsRef.current.filter((item) => item.log.id !== logId);
    }, []);

    const discard = useCallback(
        (logId: string, drainQueue = true) => {
            removeQueued(logId);
            activeLogIdsRef.current.delete(logId);
            syncActiveCount();
            if (drainQueue) drain();
        },
        [drain, removeQueued, syncActiveCount],
    );

    const beginSubmission = useCallback(() => {
        const next = reserveVideoSubmissionSlot(activeLogIdsRef.current.size, startingTasksRef.current, concurrencyLimitRef.current);
        if (next === null) return false;
        startingTasksRef.current = next;
        syncActiveCount();
        return true;
    }, [syncActiveCount]);

    const finishSubmission = useCallback(() => {
        startingTasksRef.current = Math.max(0, startingTasksRef.current - 1);
        syncActiveCount();
    }, [syncActiveCount]);

    const reset = useCallback(() => {
        activeLogIdsRef.current.clear();
        startingTasksRef.current = 0;
        queuedLogsRef.current = [];
        queuedLogIdsRef.current.clear();
        syncActiveCount();
    }, [syncActiveCount]);

    const setConcurrencyLimit = useCallback(
        (value: number) => {
            concurrencyLimitRef.current = Math.max(1, value);
            drain();
        },
        [drain],
    );

    const atCapacity = useCallback(() => currentTaskCount() >= concurrencyLimitRef.current, [currentTaskCount]);

    return {
        activeVideoCount,
        atCapacity,
        beginSubmission,
        claim,
        discard,
        drain,
        finish,
        finishSubmission,
        removeQueued,
        reset,
        schedule,
        setConcurrencyLimit,
    };
}

export function reserveVideoSubmissionSlot(activeCount: number, startingCount: number, concurrencyLimit: number) {
    return activeCount + startingCount >= Math.max(1, concurrencyLimit) ? null : startingCount + 1;
}
