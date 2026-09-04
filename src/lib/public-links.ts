/**
 * Origem pública para links distribuídos aos leads. Quando painel e área do
 * lead moram em domínios diferentes, nunca devemos copiar o domínio do painel.
 */
export function publicLeadOrigin(): string | null {
  const configured = process.env.LEADS_HOST?.trim();
  if (!configured) return null;

  try {
    const value = configured.includes("://") ? configured : `https://${configured}`;
    return new URL(value).origin;
  } catch {
    return null;
  }
}
