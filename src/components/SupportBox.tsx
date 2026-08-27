"use client";

/** WhatsApp da equipe de suporte (formato internacional, só dígitos). */
const SUPPORT_WHATSAPP = "5511963167650";

const SUPPORT_MESSAGE = "Olá! Acabei de assistir a aula ao vivo e preciso de ajuda.";

/**
 * Bloco de suporte exibido só na tela final (aula encerrada), junto da oferta.
 * Durante a live ele não aparece — sair pro WhatsApp tirava o espectador da aula.
 * Não depende de dados do webinar — é o mesmo canal de atendimento pra todos.
 */
export function SupportBox() {
  const href = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;

  return (
    <div className="rounded-2xl border border-[var(--hw-border)] bg-[var(--hw-bg-soft)] px-5 py-4 text-center">
      <p className="text-[14px] text-[var(--hw-muted)]">
        Dúvidas, problemas ou necessita de ajuda? Fale com a nossa equipe no botão abaixo:
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--hw-border)] bg-[var(--hw-surface)] px-5 py-2.5 text-[14px] font-medium text-[var(--hw-text)] transition hover:bg-[var(--hw-chip)]"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
          <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.16c-.25.69-1.44 1.32-1.99 1.37-.53.05-1 .24-3.37-.7-2.85-1.12-4.65-4.05-4.79-4.24-.14-.19-1.14-1.52-1.14-2.9 0-1.38.72-2.06.98-2.34.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.62.48.25.6.85 2.08.92 2.23.07.14.12.31.02.5-.09.19-.14.31-.28.47l-.42.49c-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.17-.19.7-.81.89-1.09.19-.28.37-.23.62-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.33.07.12.07.68-.18 1.37Z" />
        </svg>
        Falar com a equipe
      </a>
    </div>
  );
}
