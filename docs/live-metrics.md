# Audiência em tempo real e comparação A/B

## Páginas

- **Audiência ao vivo**, no menu lateral: `/admin/ao-vivo`. Cada webinar possui seu acompanhamento em `/admin/ao-vivo/<webinar-id>`, também acessível pelo cabeçalho do webinar.
- Cada teste A/B possui **Comparar métricas** (`/admin/testes-ab/<test-id>/metricas`) e **Audiência ao vivo** (`/admin/testes-ab/<test-id>/ao-vivo`).

As telas atualizam a cada 10 segundos enquanto a aba está visível, com uma única consulta em andamento por tela. Exibem data da última atualização, atualização manual e erro explícito quando os dados estão desatualizados. A presença corresponde ao último heartbeat nos últimos 60 segundos; o player normalmente envia a cada 20 segundos. A audiência simulada configurada no webinar não entra nesses números.

O acompanhamento mostra pessoas presentes, nome quando inscritas, localização aproximada, dispositivo, posição no vídeo e tempo observado. A lista exibe até 200 pessoas recentes por variante, com indicação do limite; totais e distribuição geográfica são calculados no banco sobre todos os registros. Localização indisponível é mostrada explicitamente. A geolocalização usa os cabeçalhos da hospedagem, não GPS; VPNs e redes móveis afetam a precisão.

## Indicadores e atribuição

O webinar acumula seu histórico, incluindo acessos diretos. As métricas anteriores por transmissão continuam disponíveis. A comparação A/B inclui somente participantes com vínculo confirmado entre a distribuição, a inscrição e/ou o registro de presença, sempre conferindo o webinar atribuído. A identidade do teste elimina duplicidade na passagem de anônimo para inscrito e entre sessões. Cliques repetidos contam uma pessoa.

O total distribuído mantém o histórico. A **base acompanhada** inclui exposições registradas após a instalação desta coleta ou participantes antigos que retornaram e foram vinculados. Taxas de inscrição e audiência usam essa base, não o total histórico sem observação. Clique e chegada a 90% usam quem assistiu. Variantes removidas da distribuição continuam visíveis no histórico.

Os cookies A/B agora têm escopo `/`, para que o cadastro e o player recebam o vínculo; os antigos escopos `/ab` e `/ab/<id>` são migrados ao acessar novamente o teste. Sem esse retorno, visitas antigas sem vínculo permanecem nas métricas gerais do webinar. O painel informa o início da coleta por teste. Não há atribuição retroativa inferida. Para sessões antigas retomadas, o banco registra uma base de minutos/posição para não atribuir ao teste o tempo já assistido anteriormente. Cliques anteriores ao início da coleta/entrada no teste são excluídos.

O tempo observado é estimado por minutos com heartbeat, limitado à duração por sessão; soma sessões da pessoa. “Chegaram a 90%” usa avanço observado do vídeo. Os números não representam significância estatística. Compras não são atribuídas ao teste sem identificação verificável do checkout. O link da oferta continua exatamente como cadastrado, sem parâmetros adicionais.

## Banco e segurança

Migração: `20261029154829_webinar_live_ab_metrics.sql`. Cria vínculos A/B de inscrições e espectadores, registra exposições e fornece consultas agregadas de acompanhamento. Tabelas com RLS e funções `security invoker` acessíveis somente pela `service_role`. A leitura das páginas e atualizações valida a sessão administrativa. Falha na atribuição não impede inscrição nem presença; o erro é registrado no servidor.

## Verificação

`tests/live-metrics.database.sql` usa uma transação com rollback e verifica isolamento entre variantes, acessos diretos, deduplicação de anônimo/inscrito, presença expirada, localização, cliques repetidos, base acompanhada, exclusão de dados anteriores, variantes vazias e permissões. Executado em PostgreSQL temporário com PGlite. `tests/live-metrics-auth.test.mjs` verifica o bloqueio de sessões ausentes/inválidas e identificadores inválidos. Os testes existentes de polling verificam pausa em abas ocultas e ausência de consultas sobrepostas.
