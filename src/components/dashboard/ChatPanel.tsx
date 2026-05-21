"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2, Trash2, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SensorFrame } from "@/hooks/useSensorStream";

const API = process.env.NEXT_PUBLIC_API_URL
  ?? (typeof window !== "undefined" && !window.location.host.includes("localhost")
      ? `${window.location.origin}/_/backend`
      : "http://localhost:8000");

interface Message {
  id:      string;
  role:    "user" | "assistant" | "system";
  content: string;
  ts:      string;
  error?:  boolean;
}

const STARTERS = [
  "Was ist der aktuelle Maschinenzustand?",
  "Welche Wartungen stehen an?",
  "Erkläre die Vibrationswerte",
  "Wie kann ich die Lebensdauer verlängern?",
];

export function ChatPanel({ frame }: { frame?: SensorFrame }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id:      "welcome",
      role:    "assistant",
      content: "Hallo! Ich bin AERO, dein KI-Wartungsassistent. Ich kenne den aktuellen Maschinenzustand und die Wartungsdatenbank. Was möchtest du wissen?",
      ts:      new Date().toISOString(),
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = {
      id:   crypto.randomUUID(),
      role: "user",
      content: msg,
      ts:   new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.role !== "system" && m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: msg, history, use_frame: true }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id:      crypto.randomUUID(),
          role:    "assistant",
          content: data.content,
          ts:      data.ts ?? new Date().toISOString(),
          error:   data.error,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id:      crypto.randomUUID(),
          role:    "assistant",
          content: "Verbindungsfehler — Backend nicht erreichbar.",
          ts:      new Date().toISOString(),
          error:   true,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, loading]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="glass-card flex flex-col overflow-hidden" style={{ height: "100%" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1E1E3A] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
            AERO — KI-Chat
          </h3>
          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded border border-indigo-400/20">
            Gemma 4
          </span>
        </div>
        <button
          onClick={() => setMessages([{
            id: "welcome", role: "assistant",
            content: "Gespräch zurückgesetzt. Wie kann ich helfen?",
            ts: new Date().toISOString(),
          }])}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/[0.04] transition-colors"
          title="Chat leeren"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Nachrichten */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              {/* Avatar */}
              <div className={cn(
                "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                msg.role === "user"
                  ? "bg-indigo-500/20 border border-indigo-500/40"
                  : "bg-[#1E1E3A] border border-[#2A2A4A]"
              )}>
                {msg.role === "user"
                  ? <User className="w-3.5 h-3.5 text-indigo-400" />
                  : <Bot  className="w-3.5 h-3.5 text-cyan-400" />
                }
              </div>

              {/* Bubble */}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-indigo-500/15 border border-indigo-500/25 text-[#F1F5F9] rounded-tr-sm"
                  : msg.error
                  ? "bg-red-400/10 border border-red-400/20 text-red-400 rounded-tl-sm"
                  : "bg-[#0D0D1A] border border-[#1E1E3A] text-[#F1F5F9] rounded-tl-sm"
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <span className="text-[10px] text-[#64748B] mt-1 block">
                  {new Date(msg.ts).toLocaleTimeString("de-DE", {
                    hour: "2-digit", minute: "2-digit", second: "2-digit"
                  })}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Ladeanzeige */}
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2.5"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1E1E3A] border border-[#2A2A4A] flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="bg-[#0D0D1A] border border-[#1E1E3A] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-xs text-[#64748B]">Gemma 4 denkt…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Schnell-Fragen */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-[#1E1E3A] text-[#64748B] hover:border-indigo-500/40 hover:text-indigo-400 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Eingabe */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Frage stellen… (Enter zum Senden)"
            disabled={loading}
            className="flex-1 bg-[#0D0D1A] border border-[#1E1E3A] rounded-xl px-4 py-2.5 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
