begin;
do $$
declare
  first_id uuid := gen_random_uuid();
  second_id uuid := gen_random_uuid();
  friendly text := 'verificacao-' || replace(gen_random_uuid()::text, '-', '');
  config jsonb := jsonb_build_array(jsonb_build_object('webinar_id',gen_random_uuid(),'weight',50),jsonb_build_object('webinar_id',gen_random_uuid(),'weight',50));
begin
  insert into public.webinar_ab_tests(id,name,variants) values(first_id,'Verificação de links',config),(second_id,'Verificação de links',config);
  update public.webinar_ab_tests set slug=friendly where id=first_id;
  begin
    update public.webinar_ab_tests set slug=friendly where id=second_id;
    raise exception 'Duplicate friendly URL accepted';
  exception when unique_violation then null;
  end;
  begin
    update public.webinar_ab_tests set slug='INVALID URL' where id=second_id;
    raise exception 'Invalid friendly URL accepted';
  exception when check_violation then null;
  end;
  begin
    update public.webinar_ab_tests set slug=first_id::text where id=second_id;
    raise exception 'UUID friendly URL accepted';
  exception when check_violation then null;
  end;
  if not exists(select 1 from public.webinar_ab_tests where id=first_id and slug=friendly) then raise exception 'Friendly lookup failed'; end if;
end;
$$;
rollback;
