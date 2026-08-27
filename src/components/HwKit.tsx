"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { PresenterAvatar } from "./PresenterAvatar";

/* ------------------------------------------------------------------ *
 * Peças do tema "HotWebinar" — vermelho + branco, leitura de YouTube.
 * Visual único das telas do lead (revisáveis em /rascunho): todas as telas
 * (cadastro, contagem, sala, encerrada) montam a partir daqui, para o
 * que está no ar ser exatamente o que foi aprovado.
 * ------------------------------------------------------------------ */

const AVATAR_COLORS = [
  "#e11d48",
  "#7c3aed",
  "#0891b2",
  "#059669",
  "#d97706",
  "#2563eb",
  "#db2777",
];

export function hwColorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Classe do botão principal: pílula vermelha (o "Inscrever-se" do YouTube). */
export const hwButton =
  "inline-flex items-center justify-center rounded-full bg-[var(--hw-red)] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--hw-red-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

/** Campo de formulário no tema claro. */
export const hwInput =
  "w-full rounded-xl border border-[var(--hw-border)] bg-[var(--hw-bg-soft)] px-4 py-3 text-[15px] text-[var(--hw-text)] outline-none transition placeholder:text-[var(--hw-muted)] focus:border-[var(--hw-red)] focus:bg-[var(--hw-surface)] focus:ring-4 focus:ring-[var(--hw-red)]/15";

/** Selo AO VIVO: retângulo vermelho arredondado, igual ao do player. */
export function HwLiveBadge({ label = "AO VIVO" }: { label?: string }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[var(--hw-red)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      {label}
    </span>
  );
}

export function HwChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--hw-chip)] px-3 py-1 text-[13px] font-medium">
      {children}
    </span>
  );
}

/** Marca: logo enviado no admin ou, sem logo, wordmark com a inicial. */
export function HwLogo({
  logoUrl,
  name,
  compact,
}: {
  logoUrl?: string | null;
  name: string;
  compact?: boolean;
}) {
  const h = compact ? 38 : 54;
  return (
    <span className="inline-flex items-center gap-2.5">
      {logoUrl ? (
        // O logo já é a marca — repetir o nome ao lado polui o topo.
        <Image
          src={logoUrl}
          alt={name}
          width={h * 2}
          height={h}
          className="h-auto w-auto object-contain"
          style={{ maxHeight: h }}
          unoptimized
          priority
        />
      ) : (
        <>
          <span
            className="grid place-items-center rounded-xl bg-[var(--hw-red)] font-black text-white"
            style={{ height: h * 0.8, width: h * 0.8, fontSize: h * 0.4 }}
          >
            {name.trim().charAt(0).toUpperCase() || "•"}
          </span>
          <span className="text-[15px] font-medium tracking-tight">{name}</span>
        </>
      )}
    </span>
  );
}

/** Avatar do chat: foto de quem apresenta (quando o webinar tem
 *  `presenter_avatar_url`), inicial colorida para o resto do público. */
export function HwAvatar({
  name,
  size = 32,
  presenterName,
  presenterAvatarUrl,
}: {
  name: string;
  size?: number;
  presenterName?: string | null;
  /** Foto de quem apresenta (webinar.presenter_avatar_url). Sem ela, inicial. */
  presenterAvatarUrl?: string | null;
}) {
  const first = (presenterName || "").trim().split(/\s+/)[0].toLocaleLowerCase("pt-BR");
  if (first && presenterAvatarUrl && name.toLocaleLowerCase("pt-BR").startsWith(first)) {
    return <PresenterAvatar name={name} src={presenterAvatarUrl} size={size} />;
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{
        height: size,
        width: size,
        backgroundColor: hwColorFor(name),
        fontSize: size * 0.42,
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Barra do topo — 56px, borda fina embaixo: a assinatura do YouTube. */
export function HwTopBar({
  logoUrl,
  brandName,
  presenterName,
  live,
}: {
  logoUrl?: string | null;
  brandName: string;
  presenterName?: string | null;
  live?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--hw-border)] bg-[var(--hw-bg)]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <HwLogo logoUrl={logoUrl} name={brandName} compact />
        <div className="flex items-center gap-3">
          {live && <HwLiveBadge />}
          {presenterName && (
            <span className="hidden text-[13px] text-[var(--hw-muted)] sm:inline">
              com {presenterName}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/** Casca das páginas do lead: tema + topo da marca. */
export function HwPage({
  logoUrl,
  brandName,
  presenterName,
  live,
  children,
}: {
  logoUrl?: string | null;
  brandName: string;
  presenterName?: string | null;
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="hw-theme min-h-dvh">
      <HwTopBar
        logoUrl={logoUrl}
        brandName={brandName}
        presenterName={presenterName}
        live={live}
      />
      {children}
    </div>
  );
}

/** Contagem regressiva em blocos vermelhos (dias só quando faltam). */
export function HwCountdown({ ms }: { ms: number }) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const blocos: [string, string][] = [
    [pad(Math.floor((total % 86400) / 3600)), "horas"],
    [pad(Math.floor((total % 3600) / 60)), "min"],
    [pad(total % 60), "seg"],
  ];
  if (d > 0) blocos.unshift([String(d), d === 1 ? "dia" : "dias"]);

  return (
    <div className="flex items-end gap-3">
      {blocos.map(([n, l]) => (
        <div key={l} className="flex flex-col items-center">
          <span
            className="grid min-w-[86px] place-items-center rounded-2xl bg-[var(--hw-red)] px-4 py-3 text-[44px] font-bold leading-none tabular-nums text-white sm:min-w-[104px] sm:text-[56px]"
            style={{ boxShadow: "0 14px 34px -14px rgba(255,0,0,0.75)" }}
          >
            {n}
          </span>
          <span className="mt-2 text-[12px] font-medium uppercase tracking-widest text-[var(--hw-muted)]">
            {l}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Tela "começa em breve": título, contagem e a apresentadora. */
export function HwCountdownScreen({
  title,
  ms,
  presenterName,
  presenterAvatarUrl,
}: {
  title: string;
  ms: number;
  presenterName?: string | null;
  presenterAvatarUrl?: string | null;
}) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center px-5 py-16 text-center sm:py-24">
      <HwLiveBadge label="Começa em breve" />
      <h1 className="mt-6 text-[32px] font-bold leading-tight tracking-tight sm:text-[42px]">
        {title}
      </h1>
      <p className="mt-4 text-[15px] text-[var(--hw-muted)]">A aula ao vivo começa em</p>

      <div className="mt-5">
        <HwCountdown ms={ms} />
      </div>

      <p className="mt-8 max-w-md text-[15px] leading-relaxed text-[var(--hw-muted)]">
        Não feche esta página — a sala abre sozinha no horário e a transmissão começa
        automaticamente.
      </p>

      {presenterName && (
        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-[var(--hw-border)] bg-[var(--hw-bg-soft)] px-5 py-4">
          <HwAvatar
            name={presenterName}
            size={40}
            presenterName={presenterName}
            presenterAvatarUrl={presenterAvatarUrl}
          />
          <p className="text-left text-[14px] leading-tight">
            <span className="font-semibold">{presenterName}</span>
            <br />
            <span className="text-[var(--hw-muted)]">entra ao vivo em instantes</span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Tela "aula encerrada": aviso + (quando ainda vale) a oferta e o suporte. */
export function HwEndedScreen({
  title,
  note,
  offerNote,
  offer,
  support,
}: {
  title: string;
  note: string;
  offerNote?: string | null;
  offer?: ReactNode;
  support?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col items-center px-5 py-14 text-center sm:py-20">
      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--hw-chip)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--hw-muted)]">
        <span className="h-2 w-2 rounded-full bg-[var(--hw-muted)]" />
        Aula encerrada
      </span>

      <h1 className="mt-5 text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">
        {title}
      </h1>
      <p className="mt-4 text-[17px]">Esta aula ao vivo já foi encerrada.</p>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[var(--hw-muted)]">{note}</p>

      {offer && (
        <div className="mt-8 w-full border-t border-[var(--hw-border)] pt-8">
          {offerNote && (
            <p className="mb-4 text-[14px] font-semibold text-[var(--hw-red)]">{offerNote}</p>
          )}
          {offer}
        </div>
      )}

      {support && <div className="mt-6 w-full">{support}</div>}
    </div>
  );
}
