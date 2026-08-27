import { AdminBrand } from "@/components/AdminBrand";
import { APP_NAME } from "@/lib/brand";
import { LoginForm } from "./LoginForm";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="min-h-full grid place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <AdminBrand logoHeight="h-20" />
        </div>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-7 shadow-2xl shadow-black/40 ring-1 ring-white/[0.03]">
          <h1 className="text-lg font-bold text-white">Área administrativa</h1>
          <p className="text-slate-400 mb-6 text-sm">Entre para gerenciar seus webinars.</p>
          <LoginForm next={next ?? "/admin"} />
        </div>
        <p className="text-center text-xs text-slate-600 mt-5">
          {APP_NAME} · painel seguro
        </p>
      </div>
    </div>
  );
}
