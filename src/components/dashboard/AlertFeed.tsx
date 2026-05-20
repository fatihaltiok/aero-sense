"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, XCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TwinState } from "@/hooks/useSensorStream";

type Severity = "info" | "warn" | "critical" | "ok";

interface Alert {
  id:       string;
  severity: Severity;
  title:    string;
  detail:   string;
  ts:       Date;
}

type IconComponent = React.ComponentType<{ className?: string }>;

const SEV_CFG: Record<Severity, { icon: IconComponent; color: string; bg: string; border: string }> = {
  ok:       { icon: CheckCircle,   color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/20"  },
  info:     { icon: Info,          color: "text-cyan-400",   bg: "bg-cyan-400/10",   border: "border-cyan-400/20"   },
  warn:     { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" },
  critical: { icon: XCircle,       color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/20"    },
};

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)   return `vor ${s}s`;
  if (s < 3600) return `vor ${Math.floor(s / 60)}m`;
  return `vor ${Math.floor(s / 3600)}h`;
}

interface AlertFeedProps {
  anomaly?:    boolean;
  twinState?:  TwinState;
}

export function AlertFeed({ anomaly = false, twinState }: AlertFeedProps) {
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: crypto.randomUUID(), severity: "info", title: "System gestartet", detail: "Verbindung zu CNC-Fräse Alpha hergestellt", ts: new Date(Date.now() - 120_000) },
    { id: crypto.randomUUID(), severity: "ok",   title: "Kalibrierung OK",  detail: "Alle Achsen kalibriert",                    ts: new Date(Date.now() -  80_000) },
  ]);

  const prevAnomaly = useState(false);

  // Alerts aus Echtzeitdaten generieren
  useEffect(() => {
    if (!twinState) return;

    const newAlerts: Omit<Alert, "id" | "ts">[] = [];

    if (twinState.spindle === "critical")
      newAlerts.push({ severity: "critical", title: "Spindel kritisch",     detail: "Vibration überschreitet Schwellwert 4.0g" });
    if (twinState.motor   === "critical")
      newAlerts.push({ severity: "critical", title: "Motor-Überhitzung",    detail: "Temperatur > 85 °C — Abkühlung erforderlich" });
    if (twinState.coolant === "warn")
      newAlerts.push({ severity: "warn",     title: "Kühlmittel-Warnung",   detail: "Kühlkreislauf-Temperatur erhöht" });
    if (anomaly)
      newAlerts.push({ severity: "critical", title: "Anomalie erkannt",     detail: "ML-Modell: ungewöhnliches Vibrationsmuster" });

    if (newAlerts.length === 0) return;

    setAlerts((prev) => {
      const now = new Date();
      const added = newAlerts.map((a) => ({ ...a, id: crypto.randomUUID(), ts: now }));
      return [...added, ...prev].slice(0, 10);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twinState?.spindle, twinState?.motor, twinState?.coolant, anomaly]);

  // Periodische Info-Alerts
  useEffect(() => {
    const periodic: Omit<Alert, "id" | "ts">[] = [
      { severity: "info", title: "Kalibrierung fällig",    detail: "Nächster Service in 48 h" },
      { severity: "warn", title: "Energieverbrauch erhöht", detail: "+12% über Sollwert" },
      { severity: "ok",   title: "Durchsatz normalisiert",  detail: "RPM stabil bei 2.847" },
      { severity: "info", title: "Schmiermittel prüfen",    detail: "Intervall: 72 h" },
    ];
    let i = 0;
    const id = setInterval(() => {
      setAlerts((prev) => [
        { ...periodic[i % periodic.length], id: crypto.randomUUID(), ts: new Date() },
        ...prev,
      ].slice(0, 10));
      i++;
    }, 12_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass-card flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1E1E3A] flex items-center justify-between flex-shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">Alert-Feed</h3>
        <span className="text-xs font-mono text-[#64748B]">{alerts.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {alerts.map((alert) => {
            const cfg = SEV_CFG[alert.severity];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0,   scale: 1     }}
                exit={{    opacity: 0, x: 20,   scale: 0.97  }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className={cn("flex gap-3 p-3 rounded-lg border", cfg.bg, cfg.border)}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", cfg.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-xs font-semibold truncate", cfg.color)}>{alert.title}</p>
                    <span className="text-[10px] font-mono text-[#64748B] flex-shrink-0">{timeAgo(alert.ts)}</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5 truncate">{alert.detail}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
