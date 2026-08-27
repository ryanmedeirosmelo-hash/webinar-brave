/**
 * Telefone reduzido aos 8 dígitos finais (sem +55, DDD ou o 9 extra do celular).
 * É o que sobrevive às duas pontas: o CRM guarda "5511970680474" e o cadastro do
 * webinar guarda o que a pessoa digitou ("(11) 97068-0474", "11970680474"…).
 * Usado pra cruzar convidado do disparo × inscrito da live.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  return digits.length >= 8 ? digits.slice(-8) : null;
}
