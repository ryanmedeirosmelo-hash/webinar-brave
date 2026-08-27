import { card } from "./_steps";

export function StepPlaceholder({ title }: { title: string }) {
  return (
    <div className={`${card} max-w-3xl text-center py-14`}>
      <p className="text-2xl mb-2">🛠️</p>
      <h2 className="font-semibold text-white text-lg">Etapa: {title}</h2>
      <p className="text-slate-400 mt-2 text-sm">
        Esta etapa ainda não foi construída. Me envie o print dela que eu monto igual ao HotWebinar.
      </p>
    </div>
  );
}
