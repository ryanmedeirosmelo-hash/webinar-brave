-- Run after migrations against an isolated PostgreSQL database; rolls back fixtures.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); t uuid := gen_random_uuid();
  weighted_test uuid := gen_random_uuid();
  visitor uuid := gen_random_uuid(); first_slug text; second_slug text; n bigint;
begin
  insert into public.webinars(id, slug, title, video_url, duration_seconds)
    values (a, 'ab-fixture-a-' || a, 'AB fixture A', '/test.mp4', 60),
           (b, 'ab-fixture-b-' || b, 'AB fixture B', '/test.mp4', 60);
  insert into public.webinar_ab_tests(id, name, variants) values(t, 'AB fixture',
    jsonb_build_array(jsonb_build_object('webinar_id',a,'weight',0), jsonb_build_object('webinar_id',b,'weight',100)));
  first_slug := public.assign_webinar_ab(t, visitor);
  if first_slug <> 'ab-fixture-b-' || b then raise exception '100%% allocation failed'; end if;
  second_slug := public.assign_webinar_ab(t, visitor);
  if first_slug is distinct from second_slug then raise exception 'Returning visitor changed variant'; end if;
  select visitors into n from public.webinar_ab_counts() where test_id = t and webinar_id = b;
  if n <> 1 then raise exception 'Returning visitor counted twice'; end if;
  -- Changed weights never move an existing visitor.
  update public.webinar_ab_tests set variants = jsonb_build_array(
    jsonb_build_object('webinar_id',a,'weight',100), jsonb_build_object('webinar_id',b,'weight',0)) where id = t;
  if public.assign_webinar_ab(t, visitor) is distinct from first_slug then raise exception 'Editing weights moved a visitor'; end if;
  if public.assign_webinar_ab(t, gen_random_uuid()) <> 'ab-fixture-a-' || a then raise exception 'Updated weights ignored'; end if;
  update public.webinar_ab_tests set active = false where id = t;
  if public.assign_webinar_ab(t, gen_random_uuid()) is not null then raise exception 'Paused test admitted visitor'; end if;
  if public.assign_webinar_ab(t, visitor) is distinct from first_slug then raise exception 'Pause blocked returning visitor'; end if;
  update public.webinar_ab_tests set active = true where id = t;
  update public.webinars set status = 'draft' where id = a;
  if public.assign_webinar_ab(t, gen_random_uuid()) is not null then raise exception 'Inactive webinar received traffic'; end if;
  if public.assign_webinar_ab(gen_random_uuid(), gen_random_uuid()) is not null then raise exception 'Unknown test admitted visitor'; end if;
  insert into public.webinar_ab_tests(id, name, variants) values(weighted_test, '70/30 fixture',
    jsonb_build_array(jsonb_build_object('webinar_id',a,'weight',70), jsonb_build_object('webinar_id',b,'weight',30)));
  update public.webinars set status = 'active' where id = a;
  perform public.assign_webinar_ab(weighted_test, gen_random_uuid()) from generate_series(1, 2000);
  select visitors into n from public.webinar_ab_counts() where test_id = weighted_test and webinar_id = b;
  if n is null or n < 450 or n > 750 then raise exception '70/30 allocation outside expected range: %', n; end if;
  if has_table_privilege('anon', 'public.webinar_ab_assignments', 'SELECT')
    or has_table_privilege('authenticated', 'public.webinar_ab_tests', 'UPDATE')
    or has_function_privilege('anon', 'public.assign_webinar_ab(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.webinar_ab_counts()', 'EXECUTE')
    then raise exception 'Public access allowed'; end if;
  if not has_function_privilege('service_role', 'public.assign_webinar_ab(uuid,uuid)', 'EXECUTE')
    then raise exception 'Server cannot assign visitors'; end if;
end;
$$;
rollback;
