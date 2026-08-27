"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

type Item = {
  href: string;
  label: string;
  icon: IconName;
  soon?: boolean;
  /** casa também sub-rotas (ex.: /admin/webinars/123) */
  match?: (path: string) => boolean;
};

const ITEMS: Item[] = [
  {
    href: "/admin",
    label: "Webinars",
    icon: "video",
    match: (p) => p === "/admin" || p.startsWith("/admin/webinars"),
  },
  {
    href: "/admin/metricas",
    label: "Métricas",
    icon: "chart",
    match: (p) => p.startsWith("/admin/metricas"),
  },
  {
    href: "/admin/disparos",
    label: "Disparos",
    icon: "send",
    match: (p) => p.startsWith("/admin/disparos"),
  },
  { href: "#", label: "Configurações", icon: "settings", soon: true },
];

export function SidebarNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="space-y-1 text-sm">
      {ITEMS.map((it) => {
        if (it.soon) {
          return (
            <span
              key={it.label}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-500 cursor-default"
            >
              <Icon name={it.icon} size={17} /> {it.label}
              <span className="ml-auto text-[10px] text-slate-600">em breve</span>
            </span>
          );
        }
        const active = it.match ? it.match(pathname) : pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              active
                ? "flex items-center gap-3 rounded-lg px-3 py-2.5 text-white bg-slate-800/70 font-medium ring-1 ring-white/5"
                : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800/40 transition"
            }
          >
            <Icon name={it.icon} size={17} className={active ? "text-[#cbad78]" : ""} /> {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
