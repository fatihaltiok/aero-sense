"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SensorFrame } from "@/hooks/useSensorStream";

interface DataPoint { time: number; value: number; }

const METRICS = {
  vibration:   { label: "Vibration",  color: "#6366F1", key: "vibration" as const, scale: [0, 6]    },
  temperature: { label: "Temperatur", color: "#06B6D4", key: "temp"      as const, scale: [50, 100] },
  energy:      { label: "Energie",    color: "#10B981", key: "energy"    as const, scale: [8, 22]   },
} as const;

type Metric = keyof typeof METRICS;

interface LiveChartProps {
  frame?: SensorFrame;
}

export function LiveChart({ frame }: LiveChartProps) {
  const [activeMetric, setActiveMetric] = useState<Metric>("vibration");
  const [history, setHistory] = useState<Record<Metric, DataPoint[]>>(() => {
    const seed = (base: number) =>
      Array.from({ length: 60 }, (_, i) => ({
        time: Date.now() - (59 - i) * 800,
        value: base + Math.sin(i * 0.4) * (base * 0.1) + Math.random() * (base * 0.05),
      }));
    return {
      vibration:   seed(1.8),
      temperature: seed(68),
      energy:      seed(14),
    };
  });

  const prevFrameTs = useRef<string>("");

  useEffect(() => {
    if (!frame || frame.ts === prevFrameTs.current) return;
    prevFrameTs.current = frame.ts;

    setHistory((prev) => ({
      vibration:   [...prev.vibration.slice(-79),   { time: Date.now(), value: frame.vibration.value }],
      temperature: [...prev.temperature.slice(-79), { time: Date.now(), value: frame.temp.value      }],
      energy:      [...prev.energy.slice(-79),      { time: Date.now(), value: frame.energy.value    }],
    }));
  }, [frame]);

  const cfg  = METRICS[activeMetric];
  const data = history[activeMetric];

  const W = 100, H = 100, PAD = 3;
  const [scaleMin, scaleMax] = cfg.scale;
  const range = scaleMax - scaleMin;

  const toX = (i: number) => PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
  const toY = (v: number) => H - PAD - ((Math.max(scaleMin, Math.min(scaleMax, v)) - scaleMin) / range) * (H - PAD * 2);

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(d.value)}`).join(" ");
  const areaPath = data.length > 1
    ? `${linePath} L ${toX(data.length - 1)} ${H} L ${toX(0)} ${H} Z`
    : "";

  const current = data.at(-1)?.value.toFixed(activeMetric === "vibration" ? 2 : 1) ?? "--";

  return (
    <div className="glass-card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1E1E3A] flex items-center justify-between flex-shrink-0">
        <div className="flex gap-1">
          {(Object.entries(METRICS) as [Metric, typeof METRICS[Metric]][]).map(([key, m]) => (
            <button
              key={key}
              onClick={() => setActiveMetric(key)}
              className="px-3 py-1 rounded-md text-xs font-medium transition-all"
              style={
                activeMetric === key
                  ? { background: `${m.color}20`, color: m.color, border: `1px solid ${m.color}40` }
                  : { color: "#64748B", border: "1px solid transparent" }
              }
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
          <span className="font-mono text-xs font-semibold" style={{ color: cfg.color }}>
            {current} {frame?.[cfg.key]?.unit ?? ""}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 p-3 relative min-h-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`cg-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={cfg.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={cfg.color} stopOpacity="0"   />
            </linearGradient>
          </defs>
          {/* Grid */}
          {[25, 50, 75].map((pct) => (
            <line key={pct}
              x1={PAD} y1={H - PAD - (pct / 100) * (H - PAD * 2)}
              x2={W - PAD} y2={H - PAD - (pct / 100) * (H - PAD * 2)}
              stroke="#1E1E3A" strokeWidth="0.4"
            />
          ))}
          {/* Area */}
          {areaPath && (
            <motion.path d={areaPath} fill={`url(#cg-${activeMetric})`}
              animate={{ d: areaPath }} transition={{ duration: 0.35, ease: "easeOut" }}
            />
          )}
          {/* Line */}
          {linePath && (
            <motion.path
              d={linePath} fill="none" stroke={cfg.color} strokeWidth="1.2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 4px ${cfg.color}80)` }}
              animate={{ d: linePath }} transition={{ duration: 0.35, ease: "easeOut" }}
            />
          )}
          {/* Live dot */}
          {data.length > 0 && (
            <circle
              cx={toX(data.length - 1)} cy={toY(data.at(-1)!.value)}
              r="1.8" fill={cfg.color}
              style={{ filter: `drop-shadow(0 0 5px ${cfg.color})` }}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
