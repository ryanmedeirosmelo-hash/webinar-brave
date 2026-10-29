# Testes A/B de webinars

Abra **Painel → Testes A/B** (`/admin/testes-ab`). Escolha de 2 a 10 webinars, informe as porcentagens (inteiras, somando 100%) e crie o teste. Compartilhe o link `/ab/<id>` gerado no painel. Ele redireciona à página principal do webinar sorteado e preserva os parâmetros da URL, incluindo UTMs.

A distribuição é aleatória por novo visitante: 70/30 representa uma meta, não uma cota exata de 70 a cada 100 acessos. Um cookie por teste identifica o navegador durante até um ano. O vínculo fica no banco, inclusive após mudanças nas porcentagens ou nas variantes. Outro navegador ou a remoção do cookie representa um novo visitante. Acessos diretos aos webinars não participam do teste.

Os contadores representam visitantes distribuídos, não inscrições, presença ou vendas. Os resultados são cumulativos e incluem variantes removidas da configuração. Para comparar uma nova rodada sem misturar histórico, crie outro teste. Atualize a página para carregar novas contagens.

Desmarcar **Receber novos visitantes** pausa o teste. Participantes anteriores continuam sendo redirecionados. Se um webinar com peso positivo ficar indisponível, novos participantes recebem uma mensagem de indisponibilidade até a configuração ser corrigida; o sistema não redistribui silenciosamente esse tráfego. Uma variante de peso 0 não recebe novos participantes.

## Publicação

1. Aplicar `supabase/migrations/20261021134748_webinar_ab_tests.sql` no banco do ambiente de destino.
2. Publicar o aplicativo com as variáveis já utilizadas pelo projeto (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_TOKEN`). `LEADS_HOST` continua definindo o domínio público dos links.
3. Criar um teste com webinars ativos, abrir o link em dois perfis de navegador e conferir o redirecionamento e os contadores.

As tabelas têm RLS e acesso revogado para `anon` e `authenticated`. As funções usam `security invoker` e só podem ser chamadas pela `service_role`. As ações de gravação verificam a sessão administrativa no servidor.

## Verificação

- Validação de configuração: `node --experimental-strip-types --test tests/webinar-ab.test.mjs`.
- Banco: executar `tests/webinar-ab.database.sql` após as migrações em PostgreSQL isolado. O teste desfaz seus dados ao terminar.
- A integração foi verificada em PostgreSQL temporário com PGlite, incluindo pesos 0/100, visitante recorrente, alterações de pesos, pausa, webinar inativo, contagens e permissões. Isso não substitui a conferência do ambiente publicado.
- Verificação de tipos, ESLint dos arquivos alterados e compilação de produção (`next build --webpack`) passaram em cópia temporária do código com dependências instaladas. A cópia foi usada porque as leituras de alguns arquivos locais estavam travando.
- Migração aplicada em 21/10/2026 no Supabase `webinar_brave` (`cxjkkuyimuvcsheawdsn`). Tabelas, RLS e permissões das funções verificadas no ambiente remoto. Publicação do aplicativo acompanhada pelo status do commit no GitHub.

## Links por etapa

Cada teste exibe links de página principal, sala de espera, entrada direta, cadastro, obrigado e captura. Copiar e visualizar ficam disponíveis em cada cartão. O parâmetro `pagina` seleciona a etapa, sem alterar os pesos ou a variante do visitante; UTMs e outros parâmetros seguem para o destino, e `pagina` é removido.

Em **Editar teste e links**, personalize a **URL amigável do teste**, por exemplo `campanha-outubro`. Os links passam a usar `/ab/campanha-outubro?pagina=captura` e `/ab/campanha-outubro?pagina=obrigado`. O nome é exclusivo, aceita letras minúsculas, números e hífens e vale para todas as etapas. O link fixo com UUID continua válido. Ao trocar o nome, é necessário atualizar os endereços amigáveis já distribuídos.

As páginas e o conteúdo continuam sendo os do webinar escolhido: a edição aqui altera o endereço compartilhado do teste, não o conteúdo nem URLs externas. Os links específicos também aceitam webinars Just in Time, respeitando o próximo horário de início. A identificação do visitante é compartilhada entre todas as etapas e nomes do mesmo teste; cookies antigos são migrados pela entrada com UUID.

A migração `20261029140209_webinar_ab_public_links.sql` adiciona o endereço amigável opcional sem mudar testes ou distribuições existentes.
