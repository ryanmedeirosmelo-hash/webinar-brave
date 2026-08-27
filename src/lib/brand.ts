/**
 * Configuração de marca (white label).
 *
 * Nada de nome de cliente no código: tudo que é "cara do negócio" vem do banco
 * (cada webinar tem logo, cor, apresentador…) ou destas envs, que valem para a
 * instalação inteira — nome do produto, logo do painel e as listas de exceção
 * por slug.
 *
 * As envs `NEXT_PUBLIC_*` são inlinadas no build, então precisam ser lidas
 * literalmente (`process.env.NEXT_PUBLIC_X`) — por isso este módulo existe em
 * vez de um acesso dinâmico.
 */

/** Nome do produto/instalação — aparece no painel e no título das páginas. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "AutoWebinar";

/** Título padrão do site (aba do navegador) quando a página não define o seu. */
export const SITE_TITLE = process.env.NEXT_PUBLIC_SITE_TITLE?.trim() || APP_NAME;

/** Logo do painel admin (URL ou caminho em /public). Sem isso, usa o wordmark. */
export const ADMIN_LOGO_URL = process.env.NEXT_PUBLIC_ADMIN_LOGO_URL?.trim() || null;

/**
 * Fuso usado para AGRUPAR e EXIBIR datas no painel (relatórios por dia).
 * Cada webinar tem o seu fuso no banco; este aqui é o do time que administra.
 */
export const ADMIN_TIMEZONE = process.env.NEXT_PUBLIC_ADMIN_TIMEZONE?.trim() || "America/Sao_Paulo";

/** Cor de destaque do painel admin (hex). */
export const ADMIN_ACCENT = process.env.NEXT_PUBLIC_ADMIN_ACCENT?.trim() || "#cbad78";

/**
 * Quebra o nome em duas partes para o wordmark ("Auto" + "Webinar", a segunda
 * na cor de destaque). Aceita CamelCase ou nome com espaços; nome de uma
 * palavra só fica inteiro na primeira parte.
 */
export function wordmarkParts(name: string): [string, string] {
  const camel = /^([A-Za-zÀ-ÿ]+?)([A-Z][A-Za-zÀ-ÿ]*)$/.exec(name.trim());
  if (camel) return [camel[1], camel[2]];
  const i = name.trim().lastIndexOf(" ");
  return i > 0 ? [name.trim().slice(0, i + 1), name.trim().slice(i + 1)] : [name.trim(), ""];
}

/** "a, b, c" → Set {"a","b","c"} (vazio quando a env não existe). */
function csv(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Webinars (por slug) com ENTRADA LIVRE PERMANENTE: nunca mostram a tela de
 * cadastro. Antes do horário fica só o cronômetro; no horário cai direto na sala.
 * Ex.: `NEXT_PUBLIC_FREE_ENTRY_SLUGS=aula-seg,aula-qui`
 */
export const FREE_ENTRY_SLUGS = csv(process.env.NEXT_PUBLIC_FREE_ENTRY_SLUGS);

/**
 * Datas soltas (YYYY-MM-DD, no fuso do webinar) com entrada livre — útil para
 * uma turma específica sem mexer no resto. Passada a data, o cadastro volta
 * sozinho, sem novo deploy. Ex.: `NEXT_PUBLIC_FREE_ENTRY_DATES=2026-07-09`
 */
export const FREE_ENTRY_DATES = csv(process.env.NEXT_PUBLIC_FREE_ENTRY_DATES);

/**
 * Webinars (por slug) que mostram a CONTAGEM REGRESSIVA já antes do dia da aula.
 * Nas turmas recorrentes a tela entre as aulas é "encerrada" de propósito — mas
 * numa aula avulsa, divulgada com antecedência, "encerrada" mata a divulgação.
 * Ex.: `NEXT_PUBLIC_PRE_COUNTDOWN_SLUGS=aula-avulsa`
 */
export const PRE_COUNTDOWN_SLUGS = csv(process.env.NEXT_PUBLIC_PRE_COUNTDOWN_SLUGS);
