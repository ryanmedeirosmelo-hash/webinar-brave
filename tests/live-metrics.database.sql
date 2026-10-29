begin;
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); t uuid:=gen_random_uuid();
  visitor uuid:=gen_random_uuid(); other_visitor uuid:=gen_random_uuid(); stale_visitor uuid:=gen_random_uuid();
  legacy_visitor uuid:=gen_random_uuid(); legacy_key text:='fixture-legacy-'||gen_random_uuid();
  reg uuid:=gen_random_uuid(); token uuid:=gen_random_uuid();
  anon_key text:='fixture-anon-'||gen_random_uuid(); registered_key text:='fixture-reg-'||gen_random_uuid();
  direct_key text:='fixture-direct-'||gen_random_uuid(); stale_key text:='fixture-stale-'||gen_random_uuid();
  snapshot jsonb; comparisons jsonb; claimed jsonb;
begin
  insert into public.webinars(id,slug,title,video_url,duration_seconds) values
    (a,'fixture-'||a,'Fixture A','/test.mp4',600),(b,'fixture-'||b,'Fixture B','/test.mp4',600);
  insert into public.webinar_ab_tests(id,name,variants) values(t,'Live fixture',jsonb_build_array(jsonb_build_object('webinar_id',a,'weight',50),jsonb_build_object('webinar_id',b,'weight',50)));
  insert into public.webinar_ab_assignments(test_id,visitor_id,webinar_id) values(t,visitor,a),(t,other_visitor,b),(t,stale_visitor,a),(t,legacy_visitor,a);
  insert into public.registrations(id,webinar_id,name,email,scheduled_start_at,timezone,access_token) values(reg,a,'Participante','fixture@example.test',now(),'America/Fortaleza',token);
  insert into public.watch_sessions(viewer_key,webinar_id,anon_id,registration_id,last_position_seconds,minutes,city,region,country,last_seen_at) values
    (anon_key,a,'anon-fixture',null,120,array[0,1,2],'Fortaleza','CE','BR',now()),
    (registered_key,a,null,reg,580,array[8,9],'Fortaleza','CE','BR',now()),
    (direct_key,a,'direct-fixture',null,30,array[0],null,null,null,now()),
    (stale_key,a,'stale-fixture',null,30,array[0],'Recife','PE','BR',now()-interval '2 minutes');
  insert into public.watch_sessions(viewer_key,webinar_id,anon_id,last_position_seconds,minutes,first_seen_at,last_seen_at) values(legacy_key,a,'legacy-fixture',580,array[0,1,2,3,4,5,6,7,8,9],now()-interval '1 day',now());
  perform public.attribute_webinar_ab(a,jsonb_build_array(jsonb_build_object('test_id',t,'visitor_id',legacy_visitor)),legacy_key,null);
  insert into public.offer_clicks(webinar_id,viewer_key,clicked_at) values(a,legacy_key,now()-interval '1 day');
  claimed:=jsonb_build_array(jsonb_build_object('test_id',t,'visitor_id',visitor),jsonb_build_object('test_id',t,'visitor_id',other_visitor));
  perform public.attribute_webinar_ab(a,claimed,anon_key,null);
  perform public.attribute_webinar_ab(a,claimed,registered_key,token);
  perform public.attribute_webinar_ab(a,jsonb_build_array(jsonb_build_object('test_id',t,'visitor_id',stale_visitor)),stale_key,null);
  perform public.attribute_webinar_ab(a,claimed,registered_key,token);
  if exists(select 1 from public.webinar_ab_viewers where test_id=t and visitor_id=other_visitor) then raise exception 'Wrong variant accepted'; end if;
  insert into public.offer_clicks(webinar_id,viewer_key) values(a,anon_key),(a,registered_key),(a,registered_key),(a,direct_key);
  snapshot:=public.webinar_live_snapshot(a,t);
  if (snapshot->>'entered')::int<>3 then raise exception 'Anonymous/registered identity was duplicated or direct visit included: %',snapshot; end if;
  if (snapshot->>'watching_now')::int<>2 then raise exception 'Stale spectator included: %',snapshot; end if;
  if (snapshot->>'registered')::int<>1 or (snapshot->>'offer_clicks')::int<>1 or (snapshot->>'reached_end')::int<>1 then raise exception 'Funnel counts incorrect: %',snapshot; end if;
  if jsonb_array_length(snapshot->'locations')<>2 or not exists(select 1 from jsonb_array_elements(snapshot->'locations') x where x->>'label'='Fortaleza, CE · BR') then raise exception 'Live locations incorrect: %',snapshot; end if;
  if jsonb_array_length(snapshot->'attendees')<>2 then raise exception 'Attendee list incorrect'; end if;
  if (snapshot->>'average_seconds')::int<>120 then raise exception 'Pre-test watching minutes leaked into test metrics: %',snapshot; end if;
  snapshot:=public.webinar_live_snapshot(a,null);
  if (snapshot->>'watching_now')::int<>4 then raise exception 'Webinar must include direct visits: %',snapshot; end if;
  perform public.record_webinar_ab_exposure(t,other_visitor);
  if (select count(*) from public.webinar_ab_assignments where test_id=t and metrics_seen_at is not null)<>4 then raise exception 'Tracked denominator incorrect'; end if;
  comparisons:=public.webinar_ab_live_snapshot(t);
  if jsonb_array_length(comparisons->'variants')<>2 then raise exception 'Comparison lost variants'; end if;
  if public.webinar_ab_live_snapshot(gen_random_uuid()) is not null then raise exception 'Unknown test returned data'; end if;
  snapshot:=public.webinar_live_snapshot(b,t);
  if (snapshot->>'entered')::int<>0 or jsonb_array_length(snapshot->'locations')<>0 then raise exception 'Empty variant incorrect'; end if;
  if has_function_privilege('anon','public.webinar_live_snapshot(uuid,uuid)','execute') or has_function_privilege('authenticated','public.webinar_ab_live_snapshot(uuid)','execute') or has_function_privilege('anon','public.attribute_webinar_ab(uuid,jsonb,text,uuid)','execute') or has_function_privilege('anon','public.record_webinar_ab_exposure(uuid,uuid)','execute') then raise exception 'Public metric access allowed'; end if;
  if has_table_privilege('anon','public.webinar_ab_viewers','SELECT') then raise exception 'Public identity access allowed'; end if;
end; $$;
rollback;
