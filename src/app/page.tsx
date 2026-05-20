"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AlertFeed } from "@/components/dashboard/AlertFeed";
import { RulGauge } from "@/components/dashboard/RulGauge";
import { LiveChart } from "@/components/dashboard/LiveChart";
import { DigitalTwin } from "@/components/dashboard/DigitalTwin";
import { SimulatorPanel } from "@/components/dashboard/SimulatorPanel";
import { useSensorStream } from "@/hooks/useSensorStream";
import { Gauge, Thermometer, Zap, Activity, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { frame, connection } = useSensorStream();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#F1F5F9]">
                Process Overview
              </h1>
              <p className="text-sm text-[#64748B] mt-0.5">
                Echtzeit-Monitoring · CNC-Fräse Alpha
              </p>
            </div>
            <ConnectionBadge state={connection} />
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Drehzahl"
              value={frame.rpm.value}
              unit={frame.rpm.unit}
              status={frame.rpm.status}
              icon={Gauge}
              accentColor="#6366F1"
            />
            <KpiCard
              label="Temperatur"
              value={frame.temp.value}
              unit={frame.temp.unit}
              status={frame.temp.status}
              icon={Thermometer}
              accentColor="#06B6D4"
            />
            <KpiCard
              label="Energie"
              value={frame.energy.value}
              unit={frame.energy.unit}
              status={frame.energy.status}
              icon={Zap}
              accentColor="#10B981"
            />
            <KpiCard
              label="Vibration"
              value={frame.vibration.value}
              unit={frame.vibration.unit}
              status={frame.vibration.status}
              icon={Activity}
              accentColor="#EF4444"
            />
          </div>

          {/* Hero Zone: 3D Twin + Chart + RUL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 380 }}>
            {/* 3D Twin — 2 Spalten */}
            <div className="lg:col-span-2 h-full">
              <DigitalTwin
                twinState={frame.twin_state}
                anomaly={frame.anomaly}
              />
            </div>

            {/* RUL + Stats — 1 Spalte */}
            <div className="flex flex-col gap-4 h-full">
              <RulGauge rul={frame.rul.value} />

              <div className="glass-card p-4 flex-1 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
                  Schicht-Statistik
                </h4>
                {[
                  { label: "Betriebszeit",    value: "6h 42m", color: "#10B981" },
                  { label: "Anomalien heute", value: frame.anomaly ? "aktiv" : "0", color: frame.anomaly ? "#EF4444" : "#F59E0B" },
                  { label: "OEE",             value: "87.4 %",  color: "#6366F1" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-xs text-[#64748B]">{s.label}</span>
                    <span className="font-mono text-xs font-semibold" style={{ color: s.color }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Data Zone: Live Chart + Alert Feed + Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 300 }}>
            {/* Chart */}
            <div className="lg:col-span-2" style={{ minHeight: 280 }}>
              <LiveChart frame={frame} />
            </div>
            {/* Alert Feed */}
            <div style={{ minHeight: 280 }}>
              <AlertFeed anomaly={frame.anomaly} twinState={frame.twin_state} />
            </div>
          </div>

          {/* Simulator */}
          <SimulatorPanel />

          {/* Heatmap */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#64748B] mb-4">
              Prozess-Heatmap — Engpässe
            </h3>
            <HeatmapLive frame={frame} />
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Connection Badge ─────────────────────────────────────────────────────────
function ConnectionBadge({ state }: { state: string }) {
  const cfg = {
    open:       { icon: Wifi,    label: "Backend verbunden",    cls: "text-green-400 bg-green-400/10 border-green-400/20"  },
    connecting: { icon: Wifi,    label: "Verbinde …",           cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    closed:     { icon: WifiOff, label: "Getrennt — retry …",  cls: "text-red-400 bg-red-400/10 border-red-400/20"        },
    error:      { icon: WifiOff, label: "Verbindungsfehler",    cls: "text-red-400 bg-red-400/10 border-red-400/20"        },
  }[state] ?? { icon: WifiOff, label: state, cls: "text-[#64748B] bg-[#1E1E3A] border-[#1E1E3A]" };

  const Icon = cfg.icon;

  return (
    <div className={cn("flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border", cfg.cls)}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </div>
  );
}

// ─── Heatmap (live mit Frame-Daten) ──────────────────────────────────────────
import type { SensorFrame } from "@/hooks/useSensorStream";

function HeatmapLive({ frame }: { frame: SensorFrame }) {
  const STATIONS = ["Eingang", "Station A", "Station B", "Station C", "Station D", "Ausgang"];
  const METRICS  = ["Durchsatz", "Energie", "Vibration", "Temp."];

  const [base, setBase] = useState(() =>
    METRICS.map(() => STATIONS.map(() => Math.random() * 0.5))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setBase((prev) =>
        prev.map((row) => row.map((v) => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.08))))
      );
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // Sensor-Werte auf Heatmap aufprägen
  const values = base.map((row, mi) =>
    row.map((v) => {
      if (mi === 2) return Math.max(v, frame.vibration.value / 6);
      if (mi === 3) return Math.max(v, (frame.temp.value - 55) / 40);
      if (mi === 1) return Math.max(v, (frame.energy.value - 10) / 10);
      return v;
    })
  );

  const toColor = (v: number) => {
    if (v < 0.3) return { bg: "bg-green-500/20",  text: "text-green-400",  border: "border-green-500/20"  };
    if (v < 0.6) return { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/20" };
    if (v < 0.8) return { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/20" };
    return             { bg: "bg-red-500/25",    text: "text-red-400",    border: "border-red-500/30"    };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-[#64748B] font-medium pb-2 pr-6 w-24" />
            {STATIONS.map((s) => (
              <th key={s} className="text-center text-[#64748B] font-medium pb-2 px-2">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((metric, mi) => (
            <tr key={metric}>
              <td className="text-[#64748B] pr-6 py-1 font-medium whitespace-nowrap">{metric}</td>
              {STATIONS.map((_, si) => {
                const v = values[mi][si];
                const c = toColor(v);
                return (
                  <td key={si} className="px-1.5 py-1 text-center">
                    <div className={cn(
                      "rounded px-2 py-1.5 font-mono font-semibold border cursor-pointer",
                      "hover:scale-105 transition-all duration-200 select-none",
                      c.bg, c.text, c.border
                    )}>
                      {(v * 100).toFixed(0)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
