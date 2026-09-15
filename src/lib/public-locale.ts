export type PublicLocale = "pt" | "es";

/** Idioma dos textos fixos das páginas públicas do webinar. */
export function publicLocaleFor(language?: string | null): PublicLocale {
  return /^es(?:-|$)/i.test(language ?? "") ? "es" : "pt";
}
