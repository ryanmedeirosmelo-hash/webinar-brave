// Extrai localização + aparelho do espectador a partir dos headers da requisição.
// Geo: headers que a Vercel injeta (x-vercel-ip-*). Aparelho/navegador: user-agent.
// Em dev local (sem Vercel) o geo vem nulo — só preenche em produção.

export type ClientInfo = {
  country: string | null;
  region: string | null;
  city: string | null;
  device: string | null; // Celular | Computador | Tablet
  os: string | null;
  browser: string | null;
};

function decode(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v) || null;
  } catch {
    return v || null;
  }
}

function parseUA(ua: string): Pick<ClientInfo, "device" | "os" | "browser"> {
  if (!ua) return { device: null, os: null, browser: null };

  const isTablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua);
  const isMobile = /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile/i.test(ua);
  const device = isTablet ? "Tablet" : isMobile ? "Celular" : "Computador";

  let os: string | null = null;
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser: string | null = null;
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/CriOS/i.test(ua)) browser = "Chrome";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\/|FxiOS/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua)) browser = "Safari";

  return { device, os, browser };
}

/** Lê localização (Vercel) + aparelho (user-agent) de um objeto Headers. */
export function parseClientInfo(h: Headers): ClientInfo {
  return {
    country: h.get("x-vercel-ip-country") || null,
    region: h.get("x-vercel-ip-country-region") || null,
    city: decode(h.get("x-vercel-ip-city")),
    ...parseUA(h.get("user-agent") ?? ""),
  };
}
