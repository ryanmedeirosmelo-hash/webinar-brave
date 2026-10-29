alter table public.webinar_ab_tests add column metrics_started_at timestamptz not null default now();
alter table public.webinar_ab_assignments add column metrics_seen_at timestamptz;
create table public.webinar_ab_viewers (
  test_id uuid not null,
  visitor_id uuid not null,
  viewer_key text not null references public.watch_sessions(viewer_key) on delete cascade,
  baseline_minutes int[] not null default '{}',
  baseline_position_seconds int not null default 0,
  primary key(test_id,visitor_id,viewer_key),
  foreign key(test_id,visitor_id) references public.webinar_ab_assignments(test_id,visitor_id) on delete cascade
);
create index webinar_ab_viewers_key on public.webinar_ab_viewers(viewer_key,test_id);
create table public.webinar_ab_registrations (
  test_id uuid not null,
  visitor_id uuid not null,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  primary key(test_id,visitor_id,registration_id),
  foreign key(test_id,visitor_id) references public.webinar_ab_assignments(test_id,visitor_id) on delete cascade
);
create index webinar_ab_registrations_registration on public.webinar_ab_registrations(registration_id);
alter table public.webinar_ab_viewers enable row level security;
alter table public.webinar_ab_registrations enable row level security;
revoke all on public.webinar_ab_viewers, public.webinar_ab_registrations from anon,authenticated;
grant all on public.webinar_ab_viewers, public.webinar_ab_registrations to service_role;

create function public.attribute_webinar_ab(p_webinar_id uuid,p_visitors jsonb,p_viewer_key text default null,p_registration_token uuid default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.webinar_ab_assignments a set metrics_seen_at=coalesce(a.metrics_seen_at,now())
  from jsonb_to_recordset(p_visitors) c(test_id uuid,visitor_id uuid)
  where a.test_id=c.test_id and a.visitor_id=c.visitor_id and a.webinar_id=p_webinar_id;
  if p_viewer_key is not null then
    insert into public.webinar_ab_viewers(test_id,visitor_id,viewer_key,baseline_minutes,baseline_position_seconds)
    select a.test_id,a.visitor_id,w.viewer_key,
      case when w.first_seen_at<greatest(a.created_at,t.metrics_started_at) then w.minutes else '{}'::int[] end,
      case when w.first_seen_at<greatest(a.created_at,t.metrics_started_at) then w.last_position_seconds else 0 end
    from jsonb_to_recordset(p_visitors) c(test_id uuid,visitor_id uuid)
    join public.webinar_ab_assignments a on a.test_id=c.test_id and a.visitor_id=c.visitor_id and a.webinar_id=p_webinar_id
    join public.webinar_ab_tests t on t.id=a.test_id
    join public.watch_sessions w on w.viewer_key=p_viewer_key and w.webinar_id=p_webinar_id
    on conflict do nothing;
    -- A heartbeat also reconnects an enrolled registration when the form was skipped/reused.
    insert into public.webinar_ab_registrations(test_id,visitor_id,registration_id)
    select v.test_id,v.visitor_id,w.registration_id
    from public.webinar_ab_viewers v join public.watch_sessions w on w.viewer_key=v.viewer_key
    where v.viewer_key=p_viewer_key and w.webinar_id=p_webinar_id and w.registration_id is not null
    on conflict do nothing;
  end if;
  if p_registration_token is not null then
    insert into public.webinar_ab_registrations(test_id,visitor_id,registration_id)
    select a.test_id,a.visitor_id,r.id
    from jsonb_to_recordset(p_visitors) c(test_id uuid,visitor_id uuid)
    join public.webinar_ab_assignments a on a.test_id=c.test_id and a.visitor_id=c.visitor_id and a.webinar_id=p_webinar_id
    join public.registrations r on r.access_token=p_registration_token and r.webinar_id=p_webinar_id
    on conflict do nothing;
  end if;
end; $$;
revoke all on function public.attribute_webinar_ab(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.attribute_webinar_ab(uuid,jsonb,text,uuid) to service_role;

create function public.webinar_live_snapshot(p_webinar_id uuid,p_test_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
with webinar as (select * from public.webinars where id=p_webinar_id),
scoped as (
  select w.*,coalesce(v.baseline_position_seconds,0) as baseline_position_seconds,coalesce(v.visitor_id::text,w.registration_id::text,w.anon_id,w.viewer_key) as person,
    least(greatest(b.duration_seconds,0),case when cardinality(w.minutes)>0 then (select count(*)::int*60 from unnest(w.minutes) m where not(m=any(coalesce(v.baseline_minutes,'{}'::int[])))) else greatest(0,least(w.last_position_seconds-coalesce(v.baseline_position_seconds,0),extract(epoch from w.last_seen_at-w.first_seen_at)::int)) end) as observed_seconds
  from public.watch_sessions w join webinar b on true
  left join public.webinar_ab_viewers v on p_test_id is not null and v.test_id=p_test_id and v.viewer_key=w.viewer_key
  where w.webinar_id=p_webinar_id and (p_test_id is null or v.test_id is not null)
), latest as (select distinct on(person) * from scoped order by person,last_seen_at desc,viewer_key),
live as (select * from latest where last_seen_at>now()-interval '60 seconds'),
people as (select person,sum(observed_seconds) as seconds,bool_or(last_position_seconds>=(select duration_seconds*.9 from webinar) and (baseline_position_seconds=0 or last_position_seconds>baseline_position_seconds) and (select duration_seconds>0 from webinar)) as reached_end from scoped group by person),
clicks as (
  select distinct coalesce(v.visitor_id::text,w.registration_id::text,w.anon_id,c.viewer_key) as person
  from public.offer_clicks c left join public.watch_sessions w on w.viewer_key=c.viewer_key
  left join public.webinar_ab_viewers v on p_test_id is not null and v.test_id=p_test_id and v.viewer_key=c.viewer_key
  left join public.webinar_ab_assignments a on a.test_id=v.test_id and a.visitor_id=v.visitor_id
  left join public.webinar_ab_tests t on t.id=v.test_id
  where c.webinar_id=p_webinar_id and (p_test_id is null or (v.test_id is not null and c.clicked_at>=greatest(a.created_at,t.metrics_started_at)))
), registrations as (
  select distinct coalesce(ar.visitor_id::text,r.id::text) as person
  from public.registrations r left join public.webinar_ab_registrations ar on p_test_id is not null and ar.test_id=p_test_id and ar.registration_id=r.id
  where r.webinar_id=p_webinar_id and (p_test_id is null or ar.test_id is not null)
), locations as (
  select coalesce(nullif(concat_ws(' · ',nullif(concat_ws(', ',city,region),''),country),''),'Localização indisponível') as label,count(*) as count
  from live group by 1
), attendees as (
  select l.person as id,coalesce(nullif(r.name,''),'Anônimo') as name,
    coalesce(nullif(concat_ws(' · ',nullif(concat_ws(', ',l.city,l.region),''),l.country),''),'Localização indisponível') as location,
    l.device,l.last_position_seconds as position_seconds,l.observed_seconds,l.last_seen_at,l.session_start
  from live l left join public.registrations r on r.id=l.registration_id
  order by l.last_seen_at desc,l.person limit 200
)
select jsonb_build_object(
  'webinar_id',p_webinar_id,'title',(select coalesce(nullif(internal_name,''),title) from webinar),
  'watching_now',(select count(*) from live),'entered',(select count(*) from people),
  'registered',(select count(*) from registrations),'reached_end',(select count(*) from people where reached_end),
  'offer_clicks',(select count(*) from clicks),'average_seconds',(select coalesce(round(avg(seconds)),0) from people),
  'locations',(select coalesce(jsonb_agg(x order by x.count desc,x.label),'[]'::jsonb) from locations x),
  'attendees',(select coalesce(jsonb_agg(x),'[]'::jsonb) from attendees x),'updated_at',now()
);
$$;
revoke all on function public.webinar_live_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.webinar_live_snapshot(uuid,uuid) to service_role;

create function public.webinar_ab_live_snapshot(p_test_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
with experiment as (select * from public.webinar_ab_tests where id=p_test_id),
configured as (select x.* from experiment e,jsonb_to_recordset(e.variants) x(webinar_id uuid,weight int)),
counts as (select webinar_id,count(*) as assigned,count(*) filter(where metrics_seen_at is not null) as tracked_assigned from public.webinar_ab_assignments where test_id=p_test_id group by webinar_id),
ids as (select webinar_id from configured union select webinar_id from counts),
variants as (
  select public.webinar_live_snapshot(i.webinar_id,p_test_id)||jsonb_build_object('weight',coalesce(c.weight,0),'assigned',coalesce(n.assigned,0),'tracked_assigned',coalesce(n.tracked_assigned,0),'removed',c.webinar_id is null) as value
  from ids i left join configured c using(webinar_id) left join counts n using(webinar_id)
)
select case when exists(select 1 from experiment) then jsonb_build_object('id',p_test_id,'kind','test','title',(select name from experiment),'metrics_started_at',(select metrics_started_at from experiment),'updated_at',now(),'variants',(select coalesce(jsonb_agg(value order by value->>'title'),'[]'::jsonb) from variants)) else null end;
$$;
revoke all on function public.webinar_ab_live_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.webinar_ab_live_snapshot(uuid) to service_role;

create function public.record_webinar_ab_exposure(p_test_id uuid,p_visitor_id uuid)
returns void language sql security invoker set search_path='' as $$
  update public.webinar_ab_assignments set metrics_seen_at=coalesce(metrics_seen_at,now())
  where test_id=p_test_id and visitor_id=p_visitor_id;
$$;
revoke all on function public.record_webinar_ab_exposure(uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_webinar_ab_exposure(uuid,uuid) to service_role;
