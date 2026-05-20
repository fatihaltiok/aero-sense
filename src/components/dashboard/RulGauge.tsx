"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function RulGauge({ rul = 73 }: { rul?: number }) {
  const value = Math.max(0, Math.min(100, rul));

  const color =
    value > 50 ? "#10B981" :
    value > 20 ? "#F59E0B" :
                 "#EF4444";

  const r    = 52;
  const circ = 2 * Math.PI * r;
  const arc  = circ * 0.75;
  const dash = (value / 100) * arc;

  return (
    <div className="glass-card p-5 flex flex-col items-center gap-3 flex-shrink-0">
      <span className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
        Remaining Useful Life
      </span>

      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-[135deg]">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#1E1E3A" strokeWidth="8"
            strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
          <motion.circle
            cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            animate={{ color }}
            transition={{ duration: 0.6 }}
            className="font-display text-2xl font-bold tabular-nums"
          >
            {value.toFixed(0)}%
          </motion.span>
          <span className="text-[10px] text-[#64748B] mt-0.5">Restlaufzeit</span>
        </div>
      </div>

      <div className={cn(
        "w-full text-center text-xs font-semibold py-1.5 rounded-lg",
        value > 50 ? "bg-green-400/10 text-green-400" :
        value > 20 ? "bg-yellow-400/10 text-yellow-400" :
                     "bg-red-400/10 text-red-400 animate-pulse"
      )}>
        {value > 50 ? "Betrieb normal" : value > 20 ? "Wartung planen" : "Wartung kritisch!"}
      </div>
    </div>
  );
}
