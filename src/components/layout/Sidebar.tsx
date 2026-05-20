"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Activity,
  Cpu,
  FlameKindling,
  BarChart3,
  Settings2,
  ChevronLeft,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type IconComponent = React.ComponentType<{ className?: string }>;

const navItems: { icon: IconComponent; label: string; active: boolean }[] = [
  { icon: LayoutDashboard, label: "Dashboard",    active: true  },
  { icon: Activity,        label: "Live-Stream",  active: false },
  { icon: Cpu,             label: "Digital Twin", active: false },
  { icon: FlameKindling,   label: "Anomalien",    active: false },
  { icon: BarChart3,       label: "Analyse",      active: false },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-full border-r border-[#1E1E3A] bg-[#0D0D1A] z-20 flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#1E1E3A] overflow-hidden">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center glow-indigo">
          <Zap className="w-4 h-4 text-indigo-400" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="font-display font-bold text-sm tracking-widest text-white whitespace-nowrap"
            >
              AERO<span className="text-indigo-400">·</span>SENSE
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => (
          <NavItem key={item.label} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Settings */}
      <div className="px-2 pb-4 space-y-1">
        <NavItem
          icon={Settings2}
          label="Einstellungen"
          active={false}
          collapsed={collapsed}
        />
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-[#1E1E3A] border border-[#2A2A4A] flex items-center justify-center hover:border-indigo-500/50 transition-colors z-30"
      >
        <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronLeft className="w-3 h-3 text-[#64748B]" />
        </motion.div>
      </button>
    </motion.aside>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  collapsed,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <button
      className={cn(
        "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 overflow-hidden group",
        active
          ? "bg-indigo-500/10 text-white"
          : "text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/[0.04]"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
      )}
      <Icon
        className={cn(
          "flex-shrink-0 w-4 h-4 transition-colors",
          active ? "text-indigo-400" : "group-hover:text-[#F1F5F9]"
        )}
      />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.12 }}
            className="whitespace-nowrap font-medium"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
