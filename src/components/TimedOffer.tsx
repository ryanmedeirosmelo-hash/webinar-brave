"use client";

import { recordOfferClick } from "@/app/actions/offer-clicks";
import { hwButton } from "./HwKit";
import type { Offer } from "@/types/db";

function priceOriginal(o: Offer): string | null {
  if (o.price_original_text) return o.price_original_text;
  if (o.original_price != null) return `R$ ${o.original_price.toFixed(2).replace(".", ",")}`;
  return null;
}
function priceOffer(o: Offer): string | null {
  if (o.price_offer_text) return o.price_offer_text;
  if (o.offer_price != null) return `R$ ${o.offer_price.toFixed(2).replace(".", ",")}`;
  return null;
}

export function TimedOffer({
  offers,
  elapsed,
  webinarId,
  registrationToken,
  sessionStartIso,
  previewMode,
  stacked,
  forceVisible,
}: {
  offers: Offer[];
  elapsed: number;
  /** Revisão local (/rascunho): mostra a oferta mesmo fora do horário dela, pra
   *  conferir o card e o link de checkout sem esperar a hora do pitch. */
  forceVisible?: boolean;
  /** Empilha imagem/texto/botão em coluna. Usado em caixas estreitas (tela de
   *  "aula encerrada"), onde o card horizontal espreme o título e o CTA. */
  stacked?: boolean;
  /** Contexto p/ métricas de conversão (clique no CTA). Opcionais: sem eles o
   *  botão funciona igual, só não conta o clique. */
  webinarId?: string | null;
  registrationToken?: string | null;
  sessionStartIso?: string | null;
  previewMode?: boolean;
}) {
  const active =
    offers.find(
      (o) =>
        !o.disabled &&
        elapsed >= o.show_at_seconds &&
        (o.hide_at_seconds == null || o.hide_at_seconds === 0 || elapsed < o.hide_at_seconds)
    ) ??
    // Tela de "aula encerrada" (stacked): a aula acabou, então vale a última
    // oferta cadastrada mesmo que o horário dela caia depois do fim da sala
    // (ex.: oferta em 62min numa aula de 60min) — senão a condição prometida
    // até as 22:00 simplesmente não aparece.
    (stacked || forceVisible ? offers.filter((o) => !o.disabled).at(-1) : undefined);
  if (!active) return null;

  const img = active.image_desktop_url ?? active.image_url;
  const original = priceOriginal(active);
  const offerPrice = priceOffer(active);

  // Anexa o rastreio `sck` ao checkout (Hotmart devolve no webhook) → a compra
  // volta atribuída EXATAMENTE a esta live. Sem contexto, o link fica intacto.
  let ctaHref = active.cta_url;
  if (webinarId && !previewMode) {
    try {
      const u = new URL(active.cta_url);
      u.searchParams.set("sck", `aw|${webinarId}|${sessionStartIso ?? ""}`);
      ctaHref = u.toString();
    } catch {
      /* URL fora do padrão: não mexe */
    }
  }

  function trackClick() {
    if (previewMode || !webinarId) return; // preview/admin não conta conversão
    let anonId: string | null = null;
    if (!registrationToken) {
      try {
        anonId = localStorage.getItem("aw_vid"); // mesmo id do heartbeat anônimo
      } catch {
        /* sem storage: clique fica sem identidade → não conta */
      }
      if (!anonId) return;
    }
    recordOfferClick({
      webinarId,
      offerId: active!.id,
      registrationToken,
      anonId,
      sessionStartIso,
    }).catch(() => {});
  }

  return (
    <div
      className="animate-[slideUp_.35s_ease] rounded-2xl border border-[var(--hw-border)] bg-[var(--hw-surface)] p-4 sm:p-5"
      style={{ boxShadow: "var(--hw-shadow)" }}
    >
      <div
        className={
          stacked
            ? "flex flex-col gap-4 text-center"
            : "flex flex-col gap-4 sm:flex-row sm:items-center"
        }
      >
        {img ? (
          // `contain`: a arte do produto costuma ser quadrada (logo) — recortar
          // pra caber na caixa cortaria o nome. O fundo dá o enquadramento.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={active.title}
            className={
              stacked
                ? "mx-auto h-32 w-32 rounded-xl bg-[var(--hw-chip)] object-contain p-2"
                : "mx-auto h-24 w-24 shrink-0 rounded-xl bg-[var(--hw-chip)] object-contain p-1.5 sm:mx-0"
            }
          />
        ) : (
          <div
            className={`mx-auto grid shrink-0 place-items-center rounded-xl bg-[var(--hw-chip)] text-[28px] ${
              stacked ? "h-32 w-32" : "h-24 w-24 sm:mx-0"
            }`}
          >
            🎁
          </div>
        )}
        <div className="flex-1">
          <span className="inline-block rounded-md bg-[var(--hw-red)]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--hw-red)]">
            Oferta liberada
          </span>
          <p className="mt-1 text-[17px] font-bold leading-snug">{active.title}</p>
          {active.body && (
            <p className="mt-0.5 text-[14px] text-[var(--hw-muted)]">{active.body}</p>
          )}
          {offerPrice && (
            <p className={`mt-1 flex items-baseline gap-2 ${stacked ? "justify-center" : ""}`}>
              {original && (
                <span className="text-[14px] text-[var(--hw-muted)] line-through">{original}</span>
              )}
              <span className="text-[22px] font-bold text-[var(--hw-red)]">{offerPrice}</span>
            </p>
          )}
        </div>
        <a
          href={ctaHref}
          target={active.open_same_window ? "_self" : "_blank"}
          rel="noopener noreferrer"
          onClick={trackClick}
          className={`${hwButton} animate-pulse text-center ${
            stacked ? "w-full" : "shrink-0 max-w-full"
          }`}
        >
          {active.cta_label} →
        </a>
      </div>
    </div>
  );
}
