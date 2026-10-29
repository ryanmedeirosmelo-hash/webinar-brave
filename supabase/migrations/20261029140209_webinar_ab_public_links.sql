-- Friendly test addresses are optional; existing UUID links remain valid.
alter table public.webinar_ab_tests add column slug text;
alter table public.webinar_ab_tests add constraint webinar_ab_tests_slug_format
  check (slug is null or (length(slug) between 1 and 80
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and slug !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));
create unique index webinar_ab_tests_slug_unique on public.webinar_ab_tests(slug) where slug is not null;
