"use client";

import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { useSensorStream } from "@/hooks/useSensorStream";
import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";

export default function ChatPage() {
  const { frame } = useSensorStream();

  return (
    <div className="flex flex-col bg-[#050508]" style={{ height: "100vh" }}>
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
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="font-display font-bold text-sm text-white tracking-widest">
              AERO<span className="text-indigo-400">·</span>SENSE — KI-Chat
            </span>
          </div>
        </div>
        {/* Live-Sensor-Kurzinfo */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-[#64748B]">
          <span>RPM <span className="text-[#F1F5F9]">{frame.rpm.value.toFixed(0)}</span></span>
          <span>TEMP <span className="text-[#F1F5F9]">{frame.temp.value.toFixed(1)}°C</span></span>
          <span>VIB <span className="text-[#F1F5F9]">{frame.vibration.value.toFixed(2)}g</span></span>
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, padding: "1rem", minHeight: 0 }}>
        <ChatPanel frame={frame} />
      </div>
    </div>
  );
}
