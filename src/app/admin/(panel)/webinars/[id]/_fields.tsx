"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import type { WebinarType } from "@/types/db";

/** Título de seção com ícone de acento (visual consistente entre etapas). */
export function SectionTitle({
  icon,
  children,
  hint,
}: {
  icon?: IconName;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#cbad78]/10 text-[#cbad78]">
            <Icon name={icon} size={15} />
          </span>
        )}
        <h2 className="font-semibold text-white">{children}</h2>
      </div>
      {hint && <p className="text-sm text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

/** Abas "Webinar único" | "Just in time" controlando o campo `type`. */
export function TypeTabs({ defaultValue }: { defaultValue: WebinarType }) {
  const [value, setValue] = useState<WebinarType>(defaultValue);
  const tabs: { v: WebinarType; label: string }[] = [
    { v: "unico", label: "Webinar único" },
    { v: "just_in_time", label: "Just in time" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
      <input type="hidden" name="type" value={value} />
      {tabs.map((t) => (
        <button
          key={t.v}
          type="button"
          onClick={() => setValue(t.v)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            value === t.v ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Switch (checkbox) estilizado. Submete "on" quando ligado. */
export function Toggle({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <span className="relative inline-flex shrink-0 mt-0.5">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-slate-700 peer-checked:bg-emerald-500 transition" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
      </span>
      <span>
        <span className="text-sm text-slate-200">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

/** Campo de cor (bolinha clicável + valor). */
export function ColorField({
  name,
  defaultValue,
  label,
}: {
  name: string;
  defaultValue: string;
  label: string;
}) {
  const [v, setV] = useState(defaultValue);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="color"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-7 w-7 rounded-full border border-slate-700 bg-transparent cursor-pointer"
      />
      <input type="hidden" name={name} value={v} />
    </div>
  );
}

/** Três inputs h/m/s que viram <prefix>_h, <prefix>_m, <prefix>_s. */
export function HmsField({
  prefix,
  label,
  totalSeconds = 0,
}: {
  prefix: string;
  label: string;
  totalSeconds?: number;
}) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const box =
    "w-14 rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-white text-center text-sm focus:border-[#cbad78] focus:outline-none";
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <div className="flex items-center gap-1">
        <input name={`${prefix}_h`} type="number" min={0} defaultValue={h} className={box} />
        <span className="text-slate-500">h</span>
        <input name={`${prefix}_m`} type="number" min={0} max={59} defaultValue={m} className={box} />
        <span className="text-slate-500">m</span>
        <input name={`${prefix}_s`} type="number" min={0} max={59} defaultValue={s} className={box} />
        <span className="text-slate-500">s</span>
      </div>
    </div>
  );
}
