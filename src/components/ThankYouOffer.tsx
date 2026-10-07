"use client";

import { useEffect, useState } from "react";
import { publicLocaleFor } from "@/lib/public-locale";
import type { Offer } from "@/types/db";
import { TimedOffer } from "./TimedOffer";

const OFFER_WINDOW_MS = 5 * 60 * 1000;

function formatRemaining(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ThankYouOffer({
  slug,
  offers,
  webinarId,
  registrationToken,
  sessionStartIso,
  previewMode,
  language,
}: {
  slug: string;
  offers: Offer[];
  webinarId: string;
  registrationToken: string | null;
  sessionStartIso: string | null;
  previewMode: boolean;
  language: string | null;
}) {
  const locale = publicLocaleFor(language);
  const [remainingMs, setRemainingMs] = useState(OFFER_WINDOW_MS);

  useEffect(() => {
    const storageKey = `aw_thank_you_offer_deadline:${slug}`;
    let deadline: number;

    try {
      const savedDeadline = Number(window.sessionStorage.getItem(storageKey));
      deadline = Number.isFinite(savedDeadline) && savedDeadline > 0
        ? savedDeadline
        : Date.now() + OFFER_WINDOW_MS;
      window.sessionStorage.setItem(storageKey, String(deadline));
    } catch {
      deadline = Date.now() + OFFER_WINDOW_MS;
    }

    const updateRemaining = () => {
      setRemainingMs(Math.max(0, deadline - Date.now()));
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(intervalId);
  }, [slug]);

  const expired = remainingMs <= 0;

  return (
    <section
      id="oferta"
      aria-labelledby="offer-heading"
      className="mt-10 rounded-3xl border-2 border-[var(--hw-red)]/20 bg-[var(--hw-surface)] p-4 shadow-[0_24px_70px_-42px_rgba(255,0,0,0.6)] sm:p-5"
    >
      <div className="mb-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--hw-red)]">
          {locale === "es" ? "Oferta disponible" : "Oferta disponível"}
        </p>
        <h2
          id="offer-heading"
          className="mt-1 text-xl font-bold tracking-tight text-[var(--hw-text)]"
        >
          {locale === "es" ? "Entra ahora y asegura tu plaza" : "Entre agora e garanta sua vaga"}
        </h2>
        <p className="mt-3 text-sm font-medium text-[var(--hw-muted)]">
          {locale === "es" ? "Esta oferta termina en:" : "Esta oferta termina em:"}
        </p>
        <p
          role="timer"
          aria-label={formatRemaining(remainingMs)}
          className="mt-1 text-3xl font-bold tabular-nums tracking-wider text-[var(--hw-red)]"
        >
          {formatRemaining(remainingMs)}
        </p>
      </div>

      {expired ? (
        <p className="rounded-2xl border border-[var(--hw-border)] bg-[var(--hw-bg-soft)] px-4 py-6 text-center font-semibold text-[var(--hw-muted)]">
          {locale === "es" ? "Esta oferta ha finalizado." : "Esta oferta foi encerrada."}
        </p>
      ) : (
        <TimedOffer
          offers={offers}
          elapsed={Number.MAX_SAFE_INTEGER}
          webinarId={webinarId}
          registrationToken={registrationToken}
          sessionStartIso={sessionStartIso}
          previewMode={previewMode}
          forceVisible
          stacked
          language={language}
        />
      )}
    </section>
  );
}
