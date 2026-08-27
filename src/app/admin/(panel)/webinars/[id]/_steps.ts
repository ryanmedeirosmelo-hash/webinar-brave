import type { IconName } from "@/components/Icon";

// Etapas do wizard (estilo HotWebinar) — sem Chatbot e Agente de IA.
export const STEPS: { key: string; label: string; icon: IconName }[] = [
  { key: "inicio", label: "Início", icon: "flag" },
  { key: "webinar", label: "Webinar", icon: "presentation" },
  { key: "login", label: "Login", icon: "login" },
  { key: "video", label: "Vídeo", icon: "video" },
  { key: "oferta", label: "Oferta", icon: "gift" },
  { key: "chat", label: "Chat", icon: "message" },
  { key: "vendas", label: "Vendas", icon: "wallet" },
  { key: "audiencia", label: "Audiência", icon: "eye" },
  { key: "metricas", label: "Métricas", icon: "chart" },
  { key: "integracoes", label: "Integrações", icon: "grid" },
];

export type StepKey = (typeof STEPS)[number]["key"];

// estilos compartilhados dos formulários das etapas
export const input =
  "w-full rounded-lg bg-slate-900 border border-slate-700/80 px-3.5 py-2.5 text-white placeholder-slate-500 text-sm transition focus:border-[#cbad78]/70 focus:ring-2 focus:ring-[#cbad78]/25 focus:outline-none hover:border-slate-600";
export const label =
  "block text-xs font-medium text-slate-400 mb-1.5 tracking-wide";
export const card =
  "rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-lg shadow-black/20 ring-1 ring-white/[0.02]";
export const saveBtn =
  "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[#d9bd8a] to-[#c3a267] hover:from-[#e3cfa0] hover:to-[#cbad78] px-6 py-2.5 font-semibold text-[#241708] shadow-md shadow-emerald-900/30 transition active:scale-[0.98]";
