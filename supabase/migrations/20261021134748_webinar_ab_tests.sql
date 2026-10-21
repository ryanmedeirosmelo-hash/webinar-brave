-- Only server-side service_role accesses test configuration and visitor assignments.
create table public.webinar_ab_tests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  active boolean not null default true,
  variants jsonb not null check (jsonb_typeof(variants) = 'array' and jsonb_array_length(variants) between 2 and 10),
  created_at timestamptz not null default now()
);
create table public.webinar_ab_assignments (
  test_id uuid not null references public.webinar_ab_tests(id) on delete cascade,
  visitor_id uuid not null,
  webinar_id uuid not null references public.webinars(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (test_id, visitor_id)
);
create index webinar_ab_assignment_counts on public.webinar_ab_assignments(test_id, webinar_id);
alter table public.webinar_ab_tests enable row level security;
alter table public.webinar_ab_assignments enable row level security;
revoke all on public.webinar_ab_tests, public.webinar_ab_assignments from anon, authenticated;
grant all on public.webinar_ab_tests, public.webinar_ab_assignments to service_role;

-- A row lock serializes new assignments, including concurrent requests by one visitor.
-- Random weighted allocation is independent for each visitor; percentages are targets.
create function public.assign_webinar_ab(p_test_id uuid, p_visitor_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  experiment public.webinar_ab_tests;
  chosen uuid;
  destination text;
  draw double precision := random() * 100;
  cumulative integer := 0;
  variant jsonb;
begin
  select * into experiment from public.webinar_ab_tests where id = p_test_id for update;
  if not found then return null; end if;
  select a.webinar_id into chosen from public.webinar_ab_assignments a
    where a.test_id = p_test_id and a.visitor_id = p_visitor_id;
  if chosen is null then
    if not experiment.active then return null; end if;
    -- Never silently redistribute traffic if one configured webinar is unavailable.
    if exists (
      select 1 from jsonb_array_elements(experiment.variants) v
      left join public.webinars w on w.id = (v->>'webinar_id')::uuid
      where (v->>'weight')::integer > 0 and (w.id is null or w.status <> 'active')
    ) then return null; end if;
    for variant in select value from jsonb_array_elements(experiment.variants) loop
      cumulative := cumulative + (variant->>'weight')::integer;
      if draw < cumulative then chosen := (variant->>'webinar_id')::uuid; exit; end if;
    end loop;
    if chosen is null then return null; end if;
    insert into public.webinar_ab_assignments(test_id, visitor_id, webinar_id)
      values(p_test_id, p_visitor_id, chosen);
  end if;
  select slug into destination from public.webinars where id = chosen and status = 'active';
  return destination;
end;
$$;
revoke all on function public.assign_webinar_ab(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assign_webinar_ab(uuid, uuid) to service_role;

create function public.webinar_ab_counts()
returns table(test_id uuid, webinar_id uuid, visitors bigint)
language sql security invoker set search_path = '' as $$
  select test_id, webinar_id, count(*) from public.webinar_ab_assignments group by test_id, webinar_id;
$$;
revoke all on function public.webinar_ab_counts() from public, anon, authenticated;
grant execute on function public.webinar_ab_counts() to service_role;
