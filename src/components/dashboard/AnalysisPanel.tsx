"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Loader2, CheckCircle, XCircle,
  AlertTriangle, Clock, Wrench, Package, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SensorFrame } from "@/hooks/useSensorStream";

const API = process.env.NEXT_PUBLIC_API_URL
  ?? (typeof window !== "undefined" && !window.location.host.includes("localhost")
      ? `${window.location.origin}/_/backend`
      : "http://localhost:8000");

interface AnalysisResult {
  ursache:          string;
  sofortmassnahmen: string[];
  reparaturschritte: string[];
  ersatzteile:      string[];
  reparaturdauer_h: number;
  priorität:        "kritisch" | "hoch" | "mittel" | "niedrig";
  konfidenz:        number;
  hinweis?:         string;
  sensor_text?:     string;
  analyse_ts?:      string;
}

interface AnalyseState {
  id:      string;
  status:  "queued" | "running" | "done" | "error";
  result?: AnalysisResult;
  error?:  string;
}

const PRIO_CFG = {
  kritisch: { cls: "text-red-400 bg-red-400/10 border-red-400/30",    icon: XCircle      },
  hoch:     { cls: "text-orange-400 bg-orange-400/10 border-orange-400/30", icon: AlertTriangle },
  mittel:   { cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30", icon: AlertTriangle },
  niedrig:  { cls: "text-green-400 bg-green-400/10 border-green-400/30",    icon: CheckCircle   },
};

export function AnalysisPanel({ frame }: { frame: SensorFrame }) {
  const [analyse, setAnalyse] = useState<AnalyseState | null>(null);
  const [feedback, setFeedback] = useState<"idle" | "sent">("idle");
  const [korrektur, setKorrektur] = useState("");
  const [showKorrektur, setShowKorrektur] = useState(false);
  const [mechaniker, setMechaniker] = useState("Mechaniker");

  const startAnalysis = useCallback(async () => {
    setAnalyse({ id: "", status: "queued" });
    setFeedback("idle");
    setShowKorrektur(false);

    const res = await fetch(`${API}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frame }),
    });
    const { analyse_id } = await res.json();
    setAnalyse({ id: analyse_id, status: "running" });

    // Polling bis Ergebnis fertig
    const poll = setInterval(async () => {
      const r = await fetch(`${API}/analyze/${analyse_id}`);
      const data = await r.json();
      if (data.status === "done" || data.status === "error") {
        clearInterval(poll);
        setAnalyse({ id: analyse_id, status: data.status, result: data.result, error: data.error });
      }
    }, 2000);
  }, [frame]);

  const sendFeedback = useCallback(async (bestätigt: boolean) => {
    if (!analyse?.id) return;
    await fetch(`${API}/repair/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analyse_id: analyse.id,
        bestätigt,
        korrektur: bestätigt ? null : korrektur || "Keine Angabe",
        mechaniker,
      }),
    });
    setFeedback("sent");
  }, [analyse, korrektur, mechaniker]);

  const prio = analyse?.result?.priorität ?? "mittel";
  const PrioIcon = PRIO_CFG[prio]?.icon ?? AlertTriangle;

  return (
    <div className="glass-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1E1E3A] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
            KI-Analyse — Gemma 4
          </h3>
        </div>
        <button
          onClick={startAnalysis}
          disabled={analyse?.status === "queued" || analyse?.status === "running"}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all",
            "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
            "hover:bg-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {(analyse?.status === "queued" || analyse?.status === "running")
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Analysiere…</>
            : <><Brain className="w-3 h-3" /> Analysieren</>
          }
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode="wait">
          {/* Idle */}
          {!analyse && (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-xs text-[#64748B] text-center py-8">
              Klicke „Analysieren" um eine KI-Diagnose der aktuellen Sensordaten zu starten.
              <br /><span className="text-[10px]">Gemma 4 + Qdrant-Wissensbasis</span>
            </motion.p>
          )}

          {/* Laden */}
          {(analyse?.status === "queued" || analyse?.status === "running") && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-xs text-[#64748B]">
                Gemma 4 analysiert Sensordaten und Wissensbasis…
              </p>
              <p className="text-[10px] text-[#1E1E3A]">
                Erster Start lädt das Modell (~30 Sekunden)
              </p>
            </motion.div>
          )}

          {/* Fehler */}
          {analyse?.status === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-xs text-red-400">
              Fehler: {analyse.error}
            </motion.div>
          )}

          {/* Ergebnis */}
          {analyse?.status === "done" && analyse.result && (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-4">

              {/* Priorität + Ursache */}
              <div className={cn("p-3 rounded-lg border", PRIO_CFG[prio]?.cls)}>
                <div className="flex items-center gap-2 mb-2">
                  <PrioIcon className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {prio} — Konfidenz {((analyse.result.konfidenz ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs leading-relaxed">{analyse.result.ursache}</p>
              </div>

              {/* Sofortmassnahmen */}
              {analyse.result.sofortmassnahmen?.length > 0 && (
                <Section title="Sofortmaßnahmen" icon={AlertTriangle} color="text-yellow-400">
                  {analyse.result.sofortmassnahmen.map((s, i) => (
                    <Step key={i} n={i + 1} text={s} />
                  ))}
                </Section>
              )}

              {/* Reparaturschritte */}
              {analyse.result.reparaturschritte?.length > 0 && (
                <Section title="Reparaturweg" icon={Wrench} color="text-indigo-400">
                  {analyse.result.reparaturschritte.map((s, i) => (
                    <Step key={i} n={i + 1} text={s} />
                  ))}
                </Section>
              )}

              {/* Ersatzteile + Zeit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#0D0D1A] border border-[#1E1E3A]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Package className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
                      Ersatzteile
                    </span>
                  </div>
                  {analyse.result.ersatzteile?.length > 0
                    ? analyse.result.ersatzteile.map((t, i) => (
                        <p key={i} className="text-xs text-[#F1F5F9] mt-1">• {t}</p>
                      ))
                    : <p className="text-xs text-[#64748B]">Keine</p>
                  }
                </div>
                <div className="p-3 rounded-lg bg-[#0D0D1A] border border-[#1E1E3A]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
                      Zeitbedarf
                    </span>
                  </div>
                  <p className="text-2xl font-display font-bold text-[#F1F5F9]">
                    {analyse.result.reparaturdauer_h}h
                  </p>
                </div>
              </div>

              {/* Hinweis */}
              {analyse.result.hinweis && (
                <p className="text-[10px] text-[#64748B] italic">{analyse.result.hinweis}</p>
              )}

              {/* Mechaniker-Feedback */}
              {feedback === "idle" && (
                <div className="border-t border-[#1E1E3A] pt-4 space-y-3">
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                    Reparatur abgeschlossen?
                  </p>
                  <input
                    value={mechaniker}
                    onChange={(e) => setMechaniker(e.target.value)}
                    placeholder="Name Mechaniker"
                    className="w-full text-xs bg-[#0D0D1A] border border-[#1E1E3A] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-indigo-500/50"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => sendFeedback(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-400/10 border border-green-400/30 text-green-400 text-xs font-medium hover:bg-green-400/20 transition-all">
                      <CheckCircle className="w-3.5 h-3.5" /> Vorschlag war korrekt
                    </button>
                    <button onClick={() => setShowKorrektur(!showKorrektur)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-400/10 border border-red-400/30 text-red-400 text-xs font-medium hover:bg-red-400/20 transition-all">
                      <XCircle className="w-3.5 h-3.5" /> Korrektur nötig
                      <ChevronDown className={cn("w-3 h-3 transition-transform", showKorrektur && "rotate-180")} />
                    </button>
                  </div>
                  <AnimatePresence>
                    {showKorrektur && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                        <textarea
                          value={korrektur}
                          onChange={(e) => setKorrektur(e.target.value)}
                          placeholder="Was war die tatsächliche Ursache und Lösung? Diese Information wird in die Wissensbasis aufgenommen."
                          rows={4}
                          className="w-full text-xs bg-[#0D0D1A] border border-[#1E1E3A] rounded-lg px-3 py-2 text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-indigo-500/50 resize-none"
                        />
                        <button onClick={() => sendFeedback(false)}
                          className="w-full py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-all">
                          Korrektur in Wissensbasis speichern
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {feedback === "sent" && (
                <div className="border-t border-[#1E1E3A] pt-4 flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle className="w-4 h-4" />
                  Rückmeldung in Qdrant gespeichert — verbessert zukünftige Analysen.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, color, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">{title}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-2.5 text-xs text-[#F1F5F9]">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
        {n}
      </span>
      <span className="leading-relaxed">{text}</span>
    </div>
  );
}
