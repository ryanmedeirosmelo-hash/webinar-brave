-- Telefone do inscrito. Webinars recorrentes (aula-seg/aula-qui) exigem
-- nome+email+telefone pra entrar; o app valida obrigatório, mas a coluna fica
-- nullable pra não quebrar inscrições antigas.
alter table public.registrations add column if not exists phone text;
