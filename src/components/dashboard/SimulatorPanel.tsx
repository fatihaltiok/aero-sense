"use client";

import { useState, useCallback, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, Zap, AlertTriangle, Thermometer, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImpactResult {
  energy_delta:  number;
  failure_risk:  number;
  temp_delta:    number;
  throughput:    number;
}

interface SliderParam {
  key:    "rpm_pct" | "coolant_pct" | "feed_rate_pct";
  label:  string;
  desc:   string;
  color:  string;
  icon:   React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const PARAMS: SliderParam[] = [
  { key: "rpm_pct",       label: "Drehzahl",        desc: "0 = 2000 RPM, 100 = 3500 RPM", color: "#6366F1", icon: TrendingUp   },
  { key: "coolant_pct",   label: "Kühlmittelfluss", desc: "0 = kein Kühlmittel, 100 = max", color: "#06B6D4", icon: Thermometer  },
  { key: "feed_rate_pct", label: "Vorschub",         desc: "0 = langsam, 100 = schnell",    color: "#10B981", icon: TrendingUp   },
];

function ImpactBar({ label, value, color, icon: Icon, invertGood = false }: {
  label: string; value: number; color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  invertGood?: boolean;
}) {
  const isHigh    = value > 0.7;
  const isMedium  = value > 0.4;
  const barColor  = invertGood
    ? (isHigh ? "#10B981" : isMedium ? "#F59E0B" : "#EF4444")
    : (isHigh ? "#EF4444" : isMedium ? "#F59E0B" : "#10B981");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-xs text-[#64748B]">{label}</span>
        </div>
        <span className="font-mono text-xs font-semibold" style={{ color: barColor }}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1E1E3A] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor, boxShadow: `0 0 8px ${barColor}80` }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function SimulatorPanel() {
  const [params, setParams] = useState({ rpm_pct: 0.5, coolant_pct: 0.7, feed_rate_pct: 0.5 });
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runSimulation = useCallback((newParams: typeof params) => {
    startTransition(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newParams),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setImpact(await res.json());
        setError(null);
      } catch (e) {
        setError("Backend nicht erreichbar — Simulation lokal berechnet");
        // Lokale Fallback-Berechnung (gleiche Logik wie backend/sensors.py)
        const { rpm_pct: r, coolant_pct: c, feed_rate_pct: f } = newParams;
        const clamp = (v: number) => Math.max(0, Math.min(1, v));
        setImpact({
          energy_delta: clamp(r ** 1.6 * 0.8 - c * 0.15),
          failure_risk: clamp(r * 0.4 + (1 - c) * 0.35 + f * 0.25),
          temp_delta:   clamp(r * 0.7 - c * 0.4),
          throughput:   clamp((f * 0.6 + r * 0.4) * (0.5 + c * 0.5)),
        });
      }
    });
  }, []);

  const handleSlider = (key: keyof typeof params, value: number) => {
    const next = { ...params, [key]: value };
    setParams(next);
    runSimulation(next);
  };

  const riskLevel = impact
    ? impact.failure_risk > 0.7 ? "critical"
    : impact.failure_risk > 0.4 ? "warn" : "ok"
    : null;

  return (
    <div className="glass-card flex flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1E1E3A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
            Was-wäre-wenn-Simulator
          </h3>
        </div>
        {isPending && (
          <span className="text-[10px] font-mono text-indigo-400 animate-pulse">berechnet …</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#1E1E3A]">
        {/* Schieberegler */}
        <div className="p-5 bg-[#050508] space-y-5">
          {PARAMS.map((p) => (
            <div key={p.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p.icon className="w-3.5 h-3.5" style={{ color: p.color }} />
                  <span className="text-xs font-medium text-[#F1F5F9]">{p.label}</span>
                </div>
                <span className="font-mono text-xs" style={{ color: p.color }}>
                  {(params[p.key] * 100).toFixed(0)}%
                </span>
              </div>
              <div className="relative">
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={params[p.key]}
                  onChange={(e) => handleSlider(p.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${p.color} ${params[p.key] * 100}%, #1E1E3A ${params[p.key] * 100}%)`,
                    // Thumb styling via CSS
                  }}
                />
              </div>
              <p className="text-[10px] text-[#64748B]">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Impact-Vorschau */}
        <div className="p-5 bg-[#050508] space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
            Vorhergesagte Auswirkung
          </p>

          {error && (
            <div className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded px-2 py-1">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {impact ? (
              <motion.div
                key="result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <ImpactBar label="Energieverbrauch" value={impact.energy_delta} color="#6366F1" icon={Zap}          />
                <ImpactBar label="Ausfallrisiko"    value={impact.failure_risk} color="#EF4444" icon={AlertTriangle} />
                <ImpactBar label="Temperatur-Delta" value={impact.temp_delta}   color="#06B6D4" icon={Thermometer}   />
                <ImpactBar label="Durchsatz"        value={impact.throughput}   color="#10B981" icon={TrendingUp}    invertGood />

                {/* Gesamt-Empfehlung */}
                <div className={cn(
                  "mt-4 p-3 rounded-lg border text-xs font-medium",
                  riskLevel === "critical" ? "bg-red-400/10 border-red-400/20 text-red-400"
                  : riskLevel === "warn"   ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
                  :                          "bg-green-400/10 border-green-400/20 text-green-400"
                )}>
                  {riskLevel === "critical"
                    ? "Einstellungen kritisch — Ausfallrisiko zu hoch. Drehzahl reduzieren oder Kühlmittel erhöhen."
                    : riskLevel === "warn"
                    ? "Grenzbereich — Betrieb möglich, aber Monitoring intensivieren."
                    : "Optimale Einstellungen — Anlage läuft effizient."}
                </div>
              </motion.div>
            ) : (
              <motion.p key="hint" className="text-xs text-[#64748B]">
                Schieberegler bewegen für Live-Vorschau
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
