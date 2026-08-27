import { Fragment } from "react";

/**
 * Renderiza **negrito** dentro de um texto vindo do painel.
 *
 * O parágrafo da captura precisa destacar trechos ("**Às 20h, em uma aula 100%
 * gratuita,**") sem abrir a porta pra HTML cru: o texto é dividido e devolvido
 * como nós React, então nada que a pessoa digitar vira markup.
 */
export function richText(text: string): React.ReactNode {
  return text.split(/\*\*([\s\S]+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold text-[color:var(--cap-ink)]">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

/** Quebra o texto em parágrafos (linha em branco ou quebra simples). */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
