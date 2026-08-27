-- Recorrência por dia da semana legível por máquina (1=segunda … 7=domingo, ISO).
-- Antes, recurrence_dow era só texto livre de exibição e nada filtrava o dia: a
-- sala abria TODO dia no horário. Agora recurrence_days é a fonte da verdade que
-- nextSessionStart / recurrenceSlots usam para abrir a sala só em seg/qui etc.
-- recurrence_dow segue existindo apenas como rótulo de divulgação.

alter table webinars add column if not exists recurrence_days int[] not null default '{}';
