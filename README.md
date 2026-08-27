# AutoWebinar

**Plataforma white label de webinar automático ("simulated live").**
O vídeo é pré-gravado, mas roda **como se fosse ao vivo**: começa no horário exato,
não dá pra pausar nem voltar, e o chat, as notificações de venda e as ofertas
aparecem nos momentos certos da aula.

Next.js 16 + Supabase + Tailwind. Sem nome de cliente no código: marca, cores,
logo, apresentador, vídeo, chat e ofertas vêm do banco e de variáveis de ambiente.

---

## O que já funciona

**Área do lead (quem assiste)**
- Página de inscrição por webinar (`/[slug]`) com escolha de dia e horário
- Cadastro configurável (nome / e-mail / telefone) — ou **entrada livre**, sem formulário
- Contagem regressiva → sala abre sozinha no horário
- Player "ao vivo": sem barra de progresso, sem voltar, sincronizado pelo relógio
- **Just in time**: quem chega atrasado entra na aula já em andamento
- Chat simulado (roteirizado por segundo) + o visitante consegue mandar mensagem
- Notificações de venda e **ofertas cronometradas** (aparecem e somem)
- Audiência ("X assistindo agora"), fixa ou dinâmica
- Tela de "aula encerrada" com a oferta ainda válida por um tempo
- Trava de replay por navegador: quem já assistiu não reassiste

**Painel admin (`/admin`)**
- Wizard de 9 etapas por webinar: início, datas/recorrência, login/captura, vídeo,
  webinar, chat, vendas, audiência, integrações
- Upload de vídeo e de imagens direto pro Supabase Storage
- Recorrência real (ex.: toda segunda e quinta, 19:15) e aulas avulsas
- **Métricas por live**: plays, pico de audiência, quantos chegaram ao fim,
  curva de retenção minuto a minuto, cliques na oferta e compras aprovadas
- Webhook da Hotmart para casar compra × live × espectador

---

## Stack

| Camada | Escolha |
|---|---|
| App | Next.js 16 (App Router, Server Actions) + React 19 |
| Banco / Storage | Supabase (Postgres + Storage) |
| Estilo | Tailwind CSS 4 |
| Datas | date-fns / date-fns-tz |
| Validação | zod |
| Deploy | Vercel (ou qualquer host Node) |

> A interface é **pt-BR**. Não há camada de i18n ainda — traduzir é trocar as
> strings dos componentes.

---

## Começando

```bash
git clone https://github.com/SEU-USUARIO/autowebinar-whitelabel.git
cd autowebinar-whitelabel
pnpm install
cp .env.example .env.local     # preencha as chaves

npx supabase start             # Supabase local (Docker)
npx supabase db reset          # migrations + seed de demonstração
pnpm dev
```

- Aula demo: <http://localhost:3000/aula-demo>
- Painel: <http://localhost:3000/admin> (senha = `ADMIN_PASSWORD`)

O seed cria um webinar de teste apontando para `public/videos/aula.mp4` — coloque
qualquer MP4 aí (o arquivo não vai pro git). Passo a passo completo:
[`docs/06-setup-local.md`](docs/06-setup-local.md).

---

## White label — o que dá pra trocar

**Por webinar (no painel, sem tocar em código):** título, descrição, slug, logo,
cor do botão de captura, campos do formulário, nome e foto de quem apresenta,
vídeo, duração, horários, recorrência, fuso, chat, ofertas, notificações de venda
e audiência.

**Por instalação (variáveis de ambiente):**

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_APP_NAME` | Nome do produto no painel e no wordmark |
| `NEXT_PUBLIC_SITE_TITLE` | Título da aba do navegador |
| `NEXT_PUBLIC_ADMIN_LOGO_URL` | Logo do painel (URL ou caminho em `/public`) |
| `NEXT_PUBLIC_ADMIN_ACCENT` | Cor de destaque do painel |
| `NEXT_PUBLIC_ADMIN_TIMEZONE` | Fuso dos relatórios do painel |
| `NEXT_PUBLIC_FREE_ENTRY_SLUGS` | Webinars sem tela de cadastro |
| `NEXT_PUBLIC_FREE_ENTRY_DATES` | Datas soltas com entrada livre |
| `NEXT_PUBLIC_PRE_COUNTDOWN_SLUGS` | Mostram contagem antes do dia da aula |
| `ADMIN_HOST` / `LEADS_HOST` | Separar painel e área do lead em domínios diferentes |
| `REDIRECT_TO_LEADS_HOSTS` | Domínios que só redirecionam pro host do lead |

Tudo isso é opcional e tem padrão sensato — ver [`.env.example`](.env.example).

---

## Integrações (opcionais)

- **Hotmart** — `POST /api/hotmart` recebe o Postback 2.0 e registra compras
  aprovadas, ligando a venda à live e ao espectador (via `sck`). Proteja com
  `HOTMART_HOTTOK`.
- **Painel "Disparos"** — cruza quem foi convidado por WhatsApp × quem assistiu,
  lendo (somente leitura) o banco de um CRM com fluxos de automação. Liga só com
  `CRM_SUPABASE_URL`, `CRM_SUPABASE_SERVICE_ROLE_KEY` e `CRM_WEBINAR_TENANT_ID`;
  sem elas, a aba avisa que está desligada. O schema esperado está documentado em
  `src/app/admin/disparos.ts` — é o único arquivo a adaptar para outro CRM.

---

## Deploy

1. Crie um projeto no Supabase Cloud e aplique as migrations
   (`supabase/migrations/` ou `deploy/cloud_migrations.sql`).
2. Crie o bucket de vídeos e suba o MP4 pelo próprio painel.
3. Publique na Vercel com as envs do `.env.example` preenchidas.
4. Aponte o domínio (opcionalmente um para o painel e outro para os leads).

---

## Documentação

1. [`docs/01-conceito-e-escopo.md`](docs/01-conceito-e-escopo.md) — o que é e o que entra
2. [`docs/02-arquitetura-e-stack.md`](docs/02-arquitetura-e-stack.md) — tecnologias e pastas
3. [`docs/03-modelo-de-dados.md`](docs/03-modelo-de-dados.md) — tabelas + SQL
4. [`docs/04-fluxos-e-telas.md`](docs/04-fluxos-e-telas.md) — telas e rotas
5. [`docs/05-logica-simulated-live.md`](docs/05-logica-simulated-live.md) — **o coração do projeto**
6. [`docs/06-setup-local.md`](docs/06-setup-local.md) — subir na máquina
7. [`docs/07-roadmap-execucao.md`](docs/07-roadmap-execucao.md) — o que falta

---

## Licença

MIT — veja [LICENSE](LICENSE).

Este projeto é uma implementação independente da mecânica de "webinar automático".
Não é afiliado a nenhuma plataforma comercial do gênero.
