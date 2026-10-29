/** The same entry points offered by a normal webinar. */
export const AB_PAGES = [
  { key: "principal", name: "Página principal", prefix: "", hint: "Segue a configuração principal do webinar escolhido." },
  { key: "sala", name: "Sala de espera", prefix: "/sala", hint: "Mostra a contagem e abre a transmissão no horário configurado." },
  { key: "entrar", name: "Entrar direto", prefix: "/entrar", hint: "Acessa a aula sem pedir cadastro." },
  { key: "cadastro", name: "Página de cadastro", prefix: "/cadastro", hint: "Abre o formulário de inscrição do webinar escolhido." },
  { key: "obrigado", name: "Página de obrigado", prefix: "/obrigado", hint: "Abre a página final do webinar escolhido." },
  { key: "captura", name: "Página de captura", prefix: "/captura", hint: "Abre a página de captura para campanhas e anúncios." },
] as const;
export type ABPageKey = typeof AB_PAGES[number]["key"];
export function abPublicPath(test: { id: string; slug?: string | null }, page: ABPageKey) {
  const base = `/ab/${encodeURIComponent(test.slug || test.id)}`;
  return page === "principal" ? base : `${base}?pagina=${page}`;
}
export function abDestinationPath(slug: string, page: ABPageKey) {
  return `${AB_PAGES.find(p => p.key === page)!.prefix}/${encodeURIComponent(slug)}`;
}
export function isABPage(value: string): value is ABPageKey {
  return AB_PAGES.some(p => p.key === value);
}
