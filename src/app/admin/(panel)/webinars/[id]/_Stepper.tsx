"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STEPS } from "./_steps";
import { Icon } from "@/components/Icon";

export function Stepper({ webinarId }: { webinarId: string }) {
  const pathname = usePathname();
  const activeIdx = Math.max(
    0,
    STEPS.findIndex((s) => pathname.endsWith(`/${s.key}`))
  );

  return (
    <div className="flex items-start px-3">
      {STEPS.map((step, i) => {
        const active = i === activeIdx;
        const done = i < activeIdx;
        return (
          <Link
            key={step.key}
            href={`/admin/webinars/${webinarId}/${step.key}`}
            className="group relative flex flex-1 min-w-0 flex-col items-center gap-1.5 px-1"
          >
            <span
              className={`transition ${
                active
                  ? "text-[#cbad78]"
                  : done
                    ? "text-emerald-400/80"
                    : "text-slate-500 group-hover:text-slate-300"
              }`}
            >
              <Icon name={step.icon} size={19} />
            </span>
            <span
              className={`w-full truncate text-center text-[11px] font-semibold transition ${
                active
                  ? "text-[#cbad78]"
                  : done
                    ? "text-slate-300"
                    : "text-slate-500 group-hover:text-slate-300"
              }`}
            >
              {step.label}
            </span>

            {/* linha conectora (alinhada ao centro do número) */}
            {i > 0 && (
              <span
                className={`absolute bottom-[11px] left-0 right-1/2 h-px ${
                  i <= activeIdx ? "bg-emerald-500/70" : "bg-slate-700/70"
                }`}
              />
            )}
            {i < STEPS.length - 1 && (
              <span
                className={`absolute bottom-[11px] left-1/2 right-0 h-px ${
                  i < activeIdx ? "bg-emerald-500/70" : "bg-slate-700/70"
                }`}
              />
            )}

            <span
              className={`relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold transition ${
                active
                  ? "bg-[#cbad78] text-slate-950 ring-4 ring-[#cbad78]/20"
                  : done
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-slate-800 text-slate-500 ring-1 ring-slate-700"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
