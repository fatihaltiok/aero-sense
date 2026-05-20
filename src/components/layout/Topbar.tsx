"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, ChevronDown, Wifi } from "lucide-react";

const PLANTS = ["CNC-Fräse Alpha", "Förderanlage Beta", "Presslinie Gamma"];

export function Topbar() {
  const [time, setTime] = useState("");
  const [plantIndex, setPlantIndex] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-[#1E1E3A] bg-[#050508]/80 backdrop-blur-sm z-10 flex-shrink-0">
      {/* Anlage-Selector */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1E1E3A] bg-[#0D0D1A] hover:border-indigo-500/40 transition-colors text-sm"
        >
          <span className="pulse-dot bg-green-400" />
          <span className="text-[#F1F5F9] font-medium">{PLANTS[plantIndex]}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
        </button>

        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-1 w-52 rounded-lg border border-[#1E1E3A] bg-[#0D0D1A] py-1 shadow-xl z-50"
          >
            {PLANTS.map((p, i) => (
              <button
                key={p}
                onClick={() => { setPlantIndex(i); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-500/10 hover:text-white text-[#64748B] transition-colors"
              >
                {p}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Center: Live-Indikator */}
      <div className="flex items-center gap-2 text-xs text-[#64748B]">
        <Wifi className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-mono">LIVE</span>
        <span className="text-[#1E1E3A]">|</span>
        <span className="font-mono text-[#F1F5F9]">{time}</span>
      </div>

      {/* Right: Alerts + Avatar */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-white/[0.04] transition-colors">
          <Bell className="w-4 h-4 text-[#64748B]" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-[#1E1E3A]">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400">
            FA
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-[#F1F5F9] leading-none">Fatih A.</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">Operator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
