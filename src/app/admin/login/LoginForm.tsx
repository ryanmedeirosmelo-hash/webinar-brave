"use client";

import { useActionState } from "react";
import { loginAdmin, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAdmin,
    undefined
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-1">Senha</label>
        <input
          name="password"
          type="password"
          autoFocus
          required
          placeholder="••••••••"
          className="w-full rounded-lg bg-slate-900 border border-slate-700/80 px-3.5 py-2.5 text-white placeholder-slate-500 transition focus:border-[#cbad78]/70 focus:ring-2 focus:ring-[#cbad78]/25 focus:outline-none"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gradient-to-b from-[#d9bd8a] to-[#c3a267] hover:from-[#e3cfa0] hover:to-[#cbad78] disabled:opacity-60 px-4 py-2.5 font-semibold text-slate-950 shadow-md shadow-[#3a2c10]/40 transition active:scale-[0.99]"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
