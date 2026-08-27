import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAdmin } from "@/app/admin/login/actions";
import { Icon } from "@/components/Icon";
import { AdminBrand } from "@/components/AdminBrand";
import { SidebarNav } from "./_SidebarNav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full grid grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-r border-slate-800/80 bg-slate-950/80 backdrop-blur px-4 py-6">
        <Link href="/admin" className="flex flex-col items-center gap-2 px-2 mb-8 pt-2">
          <AdminBrand />
        </Link>

        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
          Gerência
        </p>
        <SidebarNav />

        <form action={logoutAdmin} className="mt-auto pt-6">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:border-red-500/50 hover:text-red-300 hover:bg-red-500/5 transition">
            <Icon name="logout" size={15} /> Sair
          </button>
        </form>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
