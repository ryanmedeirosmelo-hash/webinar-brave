export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8" role="status" aria-label="Carregando painel">
      <span className="sr-only">Carregando painel…</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
      <div className="grid gap-3" aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
        ))}
      </div>
    </div>
  );
}
