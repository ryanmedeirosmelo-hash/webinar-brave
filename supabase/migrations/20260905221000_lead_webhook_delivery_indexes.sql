-- O painel pode filtrar ou auditar entregas por webinar; este índice também
-- evita varredura completa quando um webinar é removido em cascata.
create index lead_webhook_deliveries_webinar_idx
  on public.lead_webhook_deliveries (webinar_id);
