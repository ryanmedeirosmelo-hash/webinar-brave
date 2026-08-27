import { z } from "zod";

/** Valida o payload de inscrição vindo do SignupForm. */
export const registrationSchema = z.object({
  // z.guid() aceita qualquer UUID no formato 8-4-4-4-12 (inclusive o "nil" do seed);
  // z.uuid() seria estrito a RFC e rejeitaria o id de teste 0000…0001.
  webinarId: z.guid(),
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().email("E-mail inválido."),
  // Opcional no schema base (o form de marketing não pede); o fluxo recorrente
  // (aula-seg/aula-qui) exige telefone e valida a presença na própria action.
  phone: z.string().trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."), // YYYY-MM-DD
  time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."), // HH:mm
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
