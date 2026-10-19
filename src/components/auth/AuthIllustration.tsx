"use client";

import { 
  Cpu, 
  Layers, 
  MapPin, 
  Search, 
  Share2,
  Users,
  Activity
} from "lucide-react";
import { motion } from "framer-motion";

const stages = [
  { id: "lead", name: "Lead", icon: Users, color: "bg-blue-500", x: 15, y: 25 },
  { id: "eng", name: "Engineer", icon: Cpu, color: "bg-indigo-500", x: 80, y: 25 },
  { id: "survey", name: "Survey", icon: Layers, color: "bg-purple-500", x: 15, y: 50 },
  { id: "rev", name: "Review", icon: Search, color: "bg-amber-500", x: 80, y: 50 },
  { id: "field", name: "Field", icon: MapPin, color: "bg-emerald-500", x: 15, y: 75 },
  { id: "sync", name: "Final Sync", icon: Share2, color: "bg-slate-700", x: 80, y: 75 },
];

export function AuthIllustration() {
  // SVG Path: Zig-zag flow
  const pathD = "M 15 25 L 80 25 L 15 50 L 80 50 L 15 75 L 80 75";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative h-full w-full rounded-[40px] border border-white/80 bg-white/40 px-10 pt-10 pb-5 shadow-[0_32px_64px_-16px_rgba(15,23,42,0.1)] backdrop-blur-2xl flex flex-col overflow-hidden"
    >
      {/* Header Info */}
      <div className="relative z-20 mb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100/50 mb-3">
          <Activity className="h-3 w-3 text-blue-600 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-blue-700">
            System Orchestration
          </span>
        </div>
        <h2 className="text-[28px] font-bold leading-[1.1] tracking-tight text-slate-900 mb-2">
          Coordinate your entire <br/>
          <span className="text-blue-600">Malee House lifecycle.</span>
        </h2>
        <p className="text-slate-500 text-[13px] font-medium max-w-[340px]">
          A unified workspace for leads, engineering, deliverables, and field operations.
        </p>
      </div>

      {/* Main Visual Workspace */}
      <div className="relative flex-1 w-full rounded-[28px] bg-slate-50/40 border border-slate-200/50 overflow-hidden shadow-inner mb-2">
        
        {/* Precise Technical Grid */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#0064e0 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />

        {/* Dynamic Connection SVG */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            d={pathD}
            fill="none"
            stroke="#38a5f8"
            strokeWidth="0.4"
            strokeOpacity="0.2"
            strokeDasharray="1.5 1.5"
          />
          
          {/* Data Pulse */}
          <motion.circle r="0.6" fill="#0064e0"
            animate={{ offsetDistance: ["0%", "100%"] }}
            style={{ offsetPath: `path('${pathD}')`, offsetRotate: "auto" }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
        </svg>

        {/* Stage Nodes & Cards */}
        {stages.map((stage, i) => (
          <div 
            key={stage.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: `${stage.x}%`, top: `${stage.y}%` }}
          >
            {/* Center Node Dot */}
            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full ${stage.color} opacity-40 animate-pulse z-0`} />
            
            {/* Floating Info Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="relative group"
            >
              <div className="flex items-center gap-2.5 bg-white/95 border border-white shadow-[0_4px_15px_rgba(0,0,0,0.03)] px-3 py-2 rounded-xl transition-all group-hover:-translate-y-1 group-hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
                <div className={`h-7 w-7 rounded-lg ${stage.color} flex items-center justify-center text-white shadow-sm`}>
                  <stage.icon className="h-4 w-4" />
                </div>
                <span className="text-[12px] font-bold text-slate-800 whitespace-nowrap">{stage.name}</span>
              </div>
              
              {/* Subtle Glow */}
              <div className={`absolute inset-0 rounded-xl ${stage.color} opacity-0 blur-xl group-hover:opacity-10 transition-opacity`} />
            </motion.div>
          </div>
        ))}
      </div>

      {/* Footer Credit */}
      <div className="flex justify-center border-t border-slate-100/50 pt-1.5">
        <p className="text-[10px] font-semibold text-slate-400 tracking-tight">
          Designed & developed by <span className="text-slate-600 font-bold">Triple S production</span>
        </p>
      </div>
    </motion.div>
  );
}
