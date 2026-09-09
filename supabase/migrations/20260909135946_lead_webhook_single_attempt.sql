-- O webhook é fire-and-forget: a inscrição nunca depende da resposta do
-- destino e cada entrega pode gerar, no máximo, um POST.
alter table public.lead_webhook_deliveries
  drop constraint if exists lead_webhook_deliveries_status_check;

alter table public.lead_webhook_deliveries
  add constraint lead_webhook_deliveries_status_check
  check (status in ('pending', 'sent', 'delivered', 'failed'));

-- Interrompe imediatamente os reenvios que já estavam em curso. Uma entrega
-- que já foi tentada permanece como "sent" para auditoria; uma que ainda não
-- foi tentada continua pendente para o seu único disparo.
update public.lead_webhook_deliveries
set
  status = case when attempt_count > 0 then 'sent' else 'pending' end,
  updated_at = now()
where status in ('pending', 'processing');

create or replace function public.process_lead_webhook_deliveries(
  p_batch_size integer default 20
)
returns void
language plpgsql
set search_path = public, net, pg_temp
as $$
declare
  v_delivery public.lead_webhook_deliveries%rowtype;
  v_request_id bigint;
begin
  -- A resposta continua registrada para auditoria, mas não altera a decisão de
  -- reenviar. Tanto timeout quanto HTTP 4xx/5xx encerram a entrega já enviada.
  update public.lead_webhook_deliveries as delivery
  set
    status = case
      when response.status_code between 200 and 299 then 'delivered'
      else 'sent'
    end,
    network_request_id = null,
    delivered_at = case
      when response.status_code between 200 and 299
        then coalesce(delivery.delivered_at, response.created)
      else delivery.delivered_at
    end,
    last_status_code = response.status_code,
    last_error = case
      when response.status_code between 200 and 299 then null
      else left(
        coalesce(
          nullif(response.error_msg, ''),
          case
            when response.timed_out then 'Tempo de resposta excedido'
            else 'HTTP ' || coalesce(response.status_code::text, 'sem resposta')
          end
        ),
        1000
      )
    end,
    updated_at = now()
  from net._http_response as response
  where delivery.status = 'sent'
    and delivery.network_request_id = response.id;

  -- Apenas entregas nunca tentadas entram na fila. Não há transição de volta
  -- para pending após um erro ou timeout.
  for v_delivery in
    select *
    from public.lead_webhook_deliveries
    where status = 'pending'
      and attempt_count = 0
      and next_attempt_at <= now()
    order by created_at
    limit least(greatest(p_batch_size, 1), 50)
    for update skip locked
  loop
    update public.lead_webhook_deliveries
    set
      status = 'sent',
      attempt_count = 1,
      last_attempt_at = now(),
      updated_at = now()
    where id = v_delivery.id
    returning * into v_delivery;

    begin
      select net.http_post(
        url := v_delivery.target_url,
        body := v_delivery.payload,
        headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
        timeout_milliseconds := 4000
      ) into v_request_id;

      update public.lead_webhook_deliveries
      set network_request_id = v_request_id
      where id = v_delivery.id;
    exception when others then
      update public.lead_webhook_deliveries
      set
        status = 'failed',
        network_request_id = null,
        last_error = left(sqlerrm, 1000),
        updated_at = now()
      where id = v_delivery.id;
    end;
  end loop;
end;
$$;

revoke all on function public.process_lead_webhook_deliveries(integer)
  from public, anon, authenticated;
