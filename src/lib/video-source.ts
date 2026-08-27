/**
 * Resolve a URL que vai para o `<video>` do simulated-live.
 *
 * O player da aula NÃO é um embed: ele precisa de um elemento `<video>` real
 * para travar `currentTime` no relógio, bloquear pause/seek e corrigir deriva
 * (docs/05-logica-simulated-live.md). Isso significa que a fonte tem que ser um
 * **arquivo** (mp4) ou uma **playlist HLS** (.m3u8) — nunca a página/iframe que
 * os provedores entregam no botão "compartilhar".
 *
 * Era exatamente esse o bug do Bunny: o link copiado do painel
 * (`https://player.mediadelivery.net/play/<lib>/<guid>`) é uma página HTML.
 * Jogado em `<video src>`, o browser baixa HTML, dispara
 * MEDIA_ERR_SRC_NOT_SUPPORTED e a tela fica preta/rodando pra sempre. Aqui a
 * gente traduz esse link para o HLS que a biblioteca serve de verdade.
 */

/** Campos do webinar usados na resolução (evita exigir a linha inteira). */
export type VideoFields = {
  id: string;
  video_url: string;
  video_path: string | null;
  video_provider: string;
  video_external_url: string | null;
};

export type VideoSource = {
  /** Pronta para o `<video>`/hls.js. Vazia quando o link não é tocável. */
  url: string;
  /** Por que o link não serve — exibido no painel. `null` = tudo certo. */
  problem: string | null;
};

const ok = (url: string): VideoSource => ({ url, problem: null });
const fail = (problem: string): VideoSource => ({ url: "", problem });

/** GUID do vídeo no Bunny/Cloudflare (uuid v4 ou hash de 32 hex). */
const GUID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

/** Já é mídia tocável direto (playlist HLS ou arquivo). */
const PLAYABLE_FILE = /\.(m3u8|mp4|webm)(\?|$)/i;

/** Hostnames que servem a PÁGINA do player do Bunny (HTML, não mídia). */
const BUNNY_PAGE_HOSTS = new Set(["iframe.mediadelivery.net", "player.mediadelivery.net"]);

function parse(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Hostname do CDN de cada biblioteca do Bunny Stream (`BUNNY_CDN_HOSTNAME`).
 *
 * O link `.../play/<lib>/<guid>` não carrega o hostname da pull zone, e não dá
 * para adivinhá-lo a partir do id da biblioteca — ele vem do painel do Bunny
 * (Stream → biblioteca → CDN Hostname, algo como `vz-a1b2c3d4-e5f.b-cdn.net`).
 * Aceita um valor único (vale para todas) ou pares `<lib>=<hostname>`
 * separados por vírgula, quando há mais de uma biblioteca.
 */
function bunnyCdnHostname(libraryId: string): string | null {
  const raw = process.env.BUNNY_CDN_HOSTNAME?.trim();
  if (!raw) return null;

  let fallback: string | null = null;
  for (const entry of raw.split(",")) {
    const [left, right] = entry.split("=").map((s) => s.trim());
    if (right) {
      if (left === libraryId) return right.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    } else if (left && !fallback) {
      fallback = left.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    }
  }
  return fallback;
}

function bunnySource(raw: string): VideoSource {
  const u = parse(raw);
  if (!u) return fail("Link do Bunny inválido — cole a URL completa (com https://).");

  const host = u.hostname.toLowerCase();
  const segs = u.pathname.split("/").filter(Boolean);

  // Playlist/arquivo direto do CDN: já toca.
  if (PLAYABLE_FILE.test(u.pathname)) return ok(raw);

  // Página do player: /embed/<lib>/<guid> ou /play/<lib>/<guid>.
  if (BUNNY_PAGE_HOSTS.has(host) && segs.length >= 3 && (segs[0] === "embed" || segs[0] === "play")) {
    const [, library, guid] = segs;
    const cdn = bunnyCdnHostname(library);
    if (cdn) return ok(`https://${cdn}/${guid}/playlist.m3u8`);
    return fail(
      `Este link é a página do player do Bunny (HTML) — o player da aula não consegue tocar. ` +
        `Pegue o "CDN Hostname" da biblioteca ${library} no painel do Bunny (Stream → biblioteca → ` +
        `API/CDN) e cole aqui https://SEU-CDN.b-cdn.net/${guid}/playlist.m3u8, ou defina a env ` +
        `BUNNY_CDN_HOSTNAME=${library}=seu-cdn.b-cdn.net para a conversão ser automática.`
    );
  }

  // CDN da pull zone apontando só para o vídeo (b-cdn.net ou domínio próprio):
  // falta apenas o /playlist.m3u8.
  if (!BUNNY_PAGE_HOSTS.has(host) && segs.length === 1 && GUID.test(segs[0])) {
    return ok(`${u.origin}/${segs[0]}/playlist.m3u8`);
  }

  if (BUNNY_PAGE_HOSTS.has(host)) {
    return fail(
      "Link do Bunny não reconhecido. Use a URL HLS da biblioteca: " +
        "https://SEU-CDN.b-cdn.net/<id-do-video>/playlist.m3u8"
    );
  }

  // Host desconhecido: não é papel daqui derrubar um link que talvez funcione.
  return ok(raw);
}

function cloudflareSource(raw: string): VideoSource {
  const u = parse(raw);
  if (!u) return fail("Link do Cloudflare Stream inválido — cole a URL completa (com https://).");
  if (PLAYABLE_FILE.test(u.pathname)) return ok(raw);

  const host = u.hostname.toLowerCase();
  const segs = u.pathname.split("/").filter(Boolean);

  // customer-<code>.cloudflarestream.com/<uid>/iframe|watch → manifest HLS.
  if (host.endsWith(".cloudflarestream.com") && host.startsWith("customer-") && segs.length >= 1) {
    return ok(`${u.origin}/${segs[0]}/manifest/video.m3u8`);
  }

  return fail(
    "Use a URL do manifesto HLS do Cloudflare Stream: " +
      "https://customer-<código>.cloudflarestream.com/<uid>/manifest/video.m3u8"
  );
}

/**
 * Provedores que só entregam iframe: não existe URL de mídia pública para
 * alimentar o `<video>`, então o simulated-live não funciona com eles.
 */
function iframeOnlySource(provider: string, raw: string): VideoSource {
  const u = parse(raw);
  if (u && PLAYABLE_FILE.test(u.pathname)) return ok(raw);
  const nome = provider.charAt(0).toUpperCase() + provider.slice(1);
  return fail(
    `${nome} entrega só player em iframe, e a aula precisa controlar o vídeo ` +
      "(travar o tempo, bloquear pause/avanço) — o que só dá com arquivo MP4 ou playlist .m3u8. " +
      "Use Bunny, Cloudflare Stream, um MP4 direto ou o upload próprio."
  );
}

/** Fonte de vídeo do webinar, já traduzida para algo que o player toca. */
export function resolveVideoSource(w: VideoFields): VideoSource {
  if (w.video_path) return ok(`/v/${w.id}`);

  const external = w.video_external_url?.trim();
  if (w.video_provider === "upload" || !external) return ok(w.video_url ?? "");

  switch (w.video_provider) {
    case "bunny":
      return bunnySource(external);
    case "cloudflare":
      return cloudflareSource(external);
    case "mp4":
      return ok(external);
    default:
      return iframeOnlySource(w.video_provider, external);
  }
}

/** Atalho para as páginas que só precisam da URL. */
export function resolveVideoUrl(w: VideoFields): string {
  return resolveVideoSource(w).url;
}
