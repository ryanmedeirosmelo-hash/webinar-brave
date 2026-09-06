-- Entrega confiável de integrações de novos leads.
-- A inscrição e o registro na caixa de saída são criados na mesma transação;
-- assim, uma indisponibilidade do destino não impede o acesso do participante.

-- As extensões são nativas do Supabase, mas precisam estar habilitadas neste
-- projeto antes de a fila poder despachar e agendar os POSTs assíncronos.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table public.lead_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  webinar_id uuid not null references public.webinars(id) on delete cascade,
  target_url text not null check (target_url ~ '^https://'),
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 8),
  network_request_id bigint,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_status_code integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id)
);

create index lead_webhook_deliveries_pending_idx
  on public.lead_webhook_deliveries (next_attempt_at, created_at)
  where status = 'pending';

alter table public.lead_webhook_deliveries enable row level security;
grant select, insert, update, delete on public.lead_webhook_deliveries to service_role;

create or replace function public.create_registration_with_webhook_delivery(
  p_webinar_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_scheduled_start_at timestamptz,
  p_timezone text,
  p_access_token uuid,
  p_created_at timestamptz,
  p_webhook_url text default null,
  p_webhook_payload jsonb default null
)
returns table (access_token uuid, created_at timestamptz)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_registration_id uuid;
begin
  if (p_webhook_url is null) <> (p_webhook_payload is null) then
    raise exception 'webhook URL e payload devem ser enviados juntos';
  end if;

  insert into public.registrations (
    webinar_id,
    name,
    email,
    phone,
    scheduled_start_at,
    timezone,
    access_token,
    created_at
  )
  values (
    p_webinar_id,
    p_name,
    p_email,
    p_phone,
    p_scheduled_start_at,
    p_timezone,
    p_access_token,
    p_created_at
  )
  returning id into v_registration_id;

  if p_webhook_url is not null then
    insert into public.lead_webhook_deliveries (
      registration_id,
      webinar_id,
      target_url,
      payload
    )
    values (
      v_registration_id,
      p_webinar_id,
      p_webhook_url,
      p_webhook_payload
    );
  end if;

  return query select p_access_token, p_created_at;
end;
$$;

revoke all on function public.create_registration_with_webhook_delivery(
  uuid, text, text, text, timestamptz, text, uuid, timestamptz, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_registration_with_webhook_delivery(
  uuid, text, text, text, timestamptz, text, uuid, timestamptz, text, jsonb
) to service_role;

-- Resolve respostas já retornadas, reabre falhas com backoff exponencial e
-- despacha uma nova leva. pg_net executa o POST de forma assíncrona, portanto
-- a requisição do formulário não fica presa ao provedor externo.
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
  update public.lead_webhook_deliveries as delivery
  set
    status = 'delivered',
    delivered_at = coalesce(response.created, now()),
    last_status_code = response.status_code,
    last_error = null,
    updated_at = now()
  from net._http_response as response
  where delivery.status = 'processing'
    and delivery.network_request_id = response.id
    and response.status_code between 200 and 299;

  update public.lead_webhook_deliveries as delivery
  set
    status = case when delivery.attempt_count >= 8 then 'failed' else 'pending' end,
    network_request_id = null,
    next_attempt_at = case
      when delivery.attempt_count >= 8 then delivery.next_attempt_at
      else now() + make_interval(
        secs => least(
          3600,
          (60 * power(2::numeric, greatest(delivery.attempt_count - 1, 0)))::integer
        )
      )
    end,
    last_status_code = response.status_code,
    last_error = left(
      coalesce(
        nullif(response.error_msg, ''),
        case
          when response.timed_out then 'Tempo de resposta excedido'
          else 'HTTP ' || coalesce(response.status_code::text, 'sem resposta')
        end
      ),
      1000
    ),
    updated_at = now()
  from net._http_response as response
  where delivery.status = 'processing'
    and delivery.network_request_id = response.id
    and not coalesce(response.status_code between 200 and 299, false);

  -- Um request que não recebeu resposta do pg_net em cinco minutos é liberado
  -- para uma nova tentativa; as respostas tardias não têm mais request_id
  -- associado e, portanto, não conseguem alterar uma tentativa posterior.
  update public.lead_webhook_deliveries as delivery
  set
    status = case when delivery.attempt_count >= 8 then 'failed' else 'pending' end,
    network_request_id = null,
    next_attempt_at = case
      when delivery.attempt_count >= 8 then delivery.next_attempt_at
      else now() + make_interval(
        secs => least(
          3600,
          (60 * power(2::numeric, greatest(delivery.attempt_count - 1, 0)))::integer
        )
      )
    end,
    last_error = 'Tempo de resposta excedido no pg_net',
    updated_at = now()
  where delivery.status = 'processing'
    and coalesce(delivery.last_attempt_at, delivery.created_at) < now() - interval '5 minutes';

  for v_delivery in
    select *
    from public.lead_webhook_deliveries
    where status = 'pending'
      and next_attempt_at <= now()
      and attempt_count < 8
    order by created_at
    limit least(greatest(p_batch_size, 1), 50)
    for update skip locked
  loop
    update public.lead_webhook_deliveries
    set
      status = 'processing',
      attempt_count = attempt_count + 1,
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
        status = case when attempt_count >= 8 then 'failed' else 'pending' end,
        next_attempt_at = case
          when attempt_count >= 8 then next_attempt_at
          else now() + make_interval(
            secs => least(
              3600,
              (60 * power(2::numeric, greatest(attempt_count - 1, 0)))::integer
            )
          )
        end,
        last_error = left(sqlerrm, 1000),
        updated_at = now()
      where id = v_delivery.id;
    end;
  end loop;
end;
$$;

revoke all on function public.process_lead_webhook_deliveries(integer)
  from public, anon, authenticated;

do $$
declare
  v_existing_job_id bigint;
begin
  select jobid
  into v_existing_job_id
  from cron.job
  where jobname = 'process-lead-webhook-deliveries';

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'process-lead-webhook-deliveries',
    '10 seconds',
    'select public.process_lead_webhook_deliveries(20);'
  );
end;
$$;
