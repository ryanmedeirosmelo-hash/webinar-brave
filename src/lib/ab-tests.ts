import { z } from "zod";

export const abTestSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do teste.").max(100),
  slug: z.string().trim().max(80).regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/, "Use apenas letras minúsculas, números e hífens no endereço.").refine(value => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value), "Escolha um endereço que não seja um identificador UUID.").default(""),
  variants: z.array(z.object({
    webinar_id: z.uuid(),
    weight: z.number().int().min(0).max(100),
  })).min(2, "Escolha pelo menos dois webinars.").max(10),
}).superRefine(({ variants }, ctx) => {
  if (variants.reduce((sum, v) => sum + v.weight, 0) !== 100)
    ctx.addIssue({ code: "custom", message: "As porcentagens precisam somar 100%." });
  if (new Set(variants.map(v => v.webinar_id)).size !== variants.length)
    ctx.addIssue({ code: "custom", message: "Escolha webinars diferentes para cada variante." });
});
export type ABVariant = z.infer<typeof abTestSchema>["variants"][number];
export type ABTest = { id: string; name: string; slug?: string | null; active: boolean; variants: ABVariant[]; created_at: string };
export type ABActionState = { error?: string; success?: string };
