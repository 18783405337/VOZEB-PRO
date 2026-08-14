"use client";

import { useMemo } from "react";
import { formatTime } from "./timeline-utils";

type TimelineRulerProps = {
  duration: number;
  pixelsPerSecond: number;
  majorInterval: number;
  minorInterval: number;
  width: number;
};

export function TimelineRuler({
  duration,
  pixelsPerSecond,
  majorInterval,
  minorInterval,
  width,
}: TimelineRulerProps) {
  const ticks = useMemo(() => {
    const majorTicks: { time: number; label: string }[] = [];
    const minorTicks: number[] = [];

    // Generate major ticks
    for (let time = 0; time <= duration; time += majorInterval) {
      majorTicks.push({ time, label: formatTime(time) });
    }

    // Generate minor ticks
    for (let time = 0; time <= duration; time += minorInterval) {
      if (!majorTicks.some((tick) => tick.time === time)) {
        minorTicks.push(time);
      }
    }

    return { majorTicks, minorTicks };
  }, [duration, majorInterval, minorInterval]);

  return (
    <div className="relative h-8 border-b border-border bg-muted/30" style={{ width }}>
      {/* Major ticks with labels */}
      {ticks.majorTicks.map((tick) => (
        <div
          key={`major-${tick.time}`}
          className="absolute top-0 h-full border-l border-border/60"
          style={{ left: tick.time * pixelsPerSecond }}
        >
          <span className="absolute left-1 top-1 text-[10px] text-muted-foreground">
            {tick.label}
          </span>
        </div>
      ))}

      {/* Minor ticks */}
      {ticks.minorTicks.map((time) => (
        <div
          key={`minor-${time}`}
          className="absolute top-4 h-4 border-l border-border/30"
          style={{ left: time * pixelsPerSecond }}
        />
      ))}
    </div>
  );
}
