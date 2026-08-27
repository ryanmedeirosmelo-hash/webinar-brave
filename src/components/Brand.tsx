import Image from "next/image";

/** Converte "#rrggbb" em "rgba(r,g,b,a)" (para tints/bordas suaves). */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Título para exibição nas páginas do lead: remove o prefixo "[🔴 AO VIVO]"
 * (e variações entre colchetes) do título salvo — o selo AO VIVO do layout
 * já comunica isso; o emoji gigante quebrava o visual.
 */
export function displayTitle(raw: string): string {
  return (
    raw
      .replace(/^\s*\[[^\]]*\]\s*/g, "") // "[🔴 AO VIVO] Título" → "Título"
      .replace(/🔴/gu, "") // 🔴 em qualquer posição
      .replace(/\s{2,}/g, " ")
      .trim() || raw.trim()
  );
}

/**
 * Marca do webinar: usa o logo enviado (logo_url) quando existir; senão cai num
 * wordmark elegante com a inicial em destaque na cor da marca. Mantém a
 * identidade coesa em todas as telas (cadastro, contagem, encerrada, sala).
 */
export function Brand({
  logoUrl,
  name,
  accent,
  size = "md",
}: {
  logoUrl?: string | null;
  name: string;
  accent: string;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? 34 : 44;

  if (logoUrl) {
    // Logo real (lockup ~quadrado) pede mais altura que o wordmark.
    const hLogo = size === "sm" ? 64 : 128;
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={hLogo * 2}
        height={hLogo}
        className="h-auto w-auto object-contain"
        style={{ maxHeight: hLogo }}
        priority
        unoptimized
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "•";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid place-items-center rounded-xl font-black text-white shadow-lg"
        style={{
          height: h,
          width: h,
          backgroundColor: accent,
          boxShadow: `0 8px 24px ${hexToRgba(accent, 0.35)}`,
        }}
      >
        {initial}
      </span>
      <span
        className={`font-extrabold tracking-tight text-white ${
          size === "sm" ? "text-lg" : "text-xl"
        }`}
      >
        {name}
      </span>
    </span>
  );
}
