"use client";

import { useEffect, useRef, useState, memo } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number;
  unit: string;
  delta?: number;
  status?: "ok" | "warn" | "critical";
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor?: string;
}

const statusColors = {
  ok:       { text: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/20" },
  warn:     { text: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
  critical: { text: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/20"   },
};

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const spring = useSpring(value, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => v.toFixed(decimals));
  const [text, setText] = useState(value.toFixed(decimals));

  useEffect(() => spring.set(value), [value, spring]);
  useEffect(() => display.on("change", (v) => setText(v)), [display]);

  return <span>{text}</span>;
}

export const KpiCard = memo(function KpiCard({ label, value, unit, delta, status = "ok", icon: Icon, accentColor = "#6366F1" }: KpiCardProps) {
  const colors = statusColors[status];
  const prevValue = useRef(value);

  useEffect(() => { prevValue.current = value; }, [value]);

  return (
    <motion.div
      layout
      className={cn(
        "glass-card glass-card-hover p-5 flex flex-col gap-3",
        status === "critical" && "glow-red border-red-500/30"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#64748B] uppercase tracking-widest">{label}</span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}
        >
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end gap-1.5">
        <span className="font-display text-3xl font-bold text-[#F1F5F9] leading-none tabular-nums">
          <AnimatedNumber value={value} decimals={value % 1 !== 0 ? 1 : 0} />
        </span>
        <span className="text-sm text-[#64748B] mb-0.5">{unit}</span>
      </div>

      {/* Status + Delta */}
      <div className="flex items-center justify-between">
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", colors.text, colors.bg, colors.border, "border")}>
          {status === "ok" ? "Normal" : status === "warn" ? "Warnung" : "Kritisch"}
        </span>
        {delta !== undefined && (
          <div className={cn("flex items-center gap-1 text-xs font-mono", delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-[#64748B]")}>
            {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>

      {/* Mini Sparkline Placeholder */}
      <Sparkline color={accentColor} />
    </motion.div>
  );
});

function Sparkline({ color }: { color: string }) {
  const [points, setPoints] = useState<number[]>([]);

  // Math.random() nur client-seitig — verhindert SSR/Hydration-Mismatch
  useEffect(() => {
    setPoints(Array.from({ length: 20 }, (_, i) => 40 + Math.sin(i * 0.7) * 15 + Math.random() * 10));
  }, []);

  if (points.length === 0) return <div className="w-full h-8" />;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const norm = (v: number) => ((v - min) / (max - min)) * 30;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * 200} ${30 - norm(p)}`)
    .join(" ");

  return (
    <svg viewBox="0 0 200 32" className="w-full h-8 opacity-60" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L 200 32 L 0 32 Z`} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
