# 06 — Setup Local (passo a passo)

Pré-requisitos: **Node 22+**, **pnpm**, **Docker** rodando.

## 1. Clonar e instalar

```bash
git clone https://github.com/SEU-USUARIO/autowebinar-whitelabel.git
cd autowebinar-whitelabel
pnpm install
```

## 2. Configurar o ambiente

```bash
cp .env.example .env.local
```

Preencha as chaves do Supabase (passo 3) e escolha uma senha de admin. Todas as
variáveis estão comentadas no próprio `.env.example`.

## 3. Subir o Supabase local

A pasta `supabase/` já vem no repositório (config, migrations e seed):

```bash
npx supabase start       # 1ª vez baixa imagens Docker — pode demorar alguns minutos
```

Ao terminar, o CLI imprime as credenciais. Anote:
- `API URL` (as portas vêm do `supabase/config.toml`)
- `service_role key`
- `Studio URL` — interface visual do banco

## 4. Aplicar migration + seed

As migrations e o seed já estão no repositório (`supabase/migrations/` e
`supabase/seed.sql`):

```bash
npx supabase db reset    # aplica migrations + seed do zero
```

> `db reset` apaga e recria o banco local aplicando todas as migrations e o `seed.sql`.
> Use sempre que mudar o schema durante o dev.

## 5. Vídeo de teste

Coloque um MP4 de ~10 min em:
```
public/videos/aula.mp4
```
(O `video_url` do seed aponta pra `/videos/aula.mp4`.)

## 6. Variáveis de ambiente — `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=<API URL do passo 3>
SUPABASE_SERVICE_ROLE_KEY=<service_role key do passo 3>
ADMIN_PASSWORD=troque-esta-senha
ADMIN_SESSION_TOKEN=<64 hex aleatórios>
```

> A `SERVICE_ROLE_KEY` **não** tem prefixo `NEXT_PUBLIC_` → nunca vai pro browser. Ela é
> usada só nos Server Components/Actions.

Cliente server-side — `src/lib/supabase/server.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

## 7. Rodar

```bash
pnpm dev
```

Teste:
- Inscrição: <http://localhost:3000/aula-demo>
- Painel: <http://localhost:3000/admin> (senha = `ADMIN_PASSWORD`)
- Banco (Studio): a URL impressa no passo 3.

## Comandos do dia a dia

| Comando | Para quê |
|---------|----------|
| `pnpm dev` | rodar a app |
| `npx supabase start` / `stop` | ligar/desligar o banco local |
| `npx supabase db reset` | recriar banco (migrations + seed) |
| `npx supabase status` | ver URLs e chaves de novo |

## Problemas comuns

- **"port already in use" no `supabase start`**: rode `npx supabase stop` antes, ou
  `docker ps` e pare containers antigos.
- **Vídeo não dá autoplay com som**: é esperado — começa mutado, usuário clica "Ativar som".
- **Vídeo recomeça do zero ao recarregar**: o `useEffect` de seek não está rodando no
  `canplay`; revise o [doc 05](05-logica-simulated-live.md).
- **Horário "errado" por algumas horas**: fuso. Confirme que `scheduled_start_at` foi gravado
  em UTC via `fromZonedTime` e que o cálculo usa `getTime()` (ms UTC).
