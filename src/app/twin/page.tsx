"use client";

import { DigitalTwin } from "@/components/dashboard/DigitalTwin";
import { useSensorStream } from "@/hooks/useSensorStream";
import { Wifi, WifiOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TwinPage() {
  const { frame, connection } = useSensorStream();

  const isLive = connection === "open";

  return (
    <div className="flex flex-col h-full bg-[#050508]">
      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E1E3A] flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#64748B] hover:text-[#F1F5F9] transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-[#1E1E3A]">|</span>
          <span className="font-display font-bold text-sm text-white tracking-widest">
            AERO<span className="text-indigo-400">·</span>SENSE — 3D Digital Twin
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Live-Sensor-Werte */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono">
            <span style={{ color: sColor(frame.rpm.status) }}>
              RPM {frame.rpm.value.toFixed(0)}
            </span>
            <span style={{ color: sColor(frame.temp.status) }}>
              {frame.temp.value.toFixed(1)} °C
            </span>
            <span style={{ color: sColor(frame.vibration.status) }}>
              VIB {frame.vibration.value.toFixed(2)} g
            </span>
            <span style={{ color: sColor(frame.rul.status) }}>
              RUL {frame.rul.value.toFixed(0)}%
            </span>
          </div>

          {/* Connection */}
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
            isLive
              ? "text-green-400 bg-green-400/10 border-green-400/20"
              : "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
          }`}>
            {isLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isLive ? "LIVE" : "Verbinde…"}
          </div>

          {frame.anomaly && (
            <span className="text-xs font-bold text-red-400 bg-red-400/10 border border-red-400/30 px-3 py-1 rounded-full animate-pulse">
              ⚠ ANOMALIE
            </span>
          )}
        </div>
      </div>

      {/* 3D Twin — Vollbild */}
      <div className="flex-1 p-4">
        <DigitalTwin twinState={frame.twin_state} anomaly={frame.anomaly} />
      </div>
    </div>
  );
}

function sColor(status: string) {
  return status === "critical" ? "#EF4444" : status === "warn" ? "#F59E0B" : "#10B981";
}
