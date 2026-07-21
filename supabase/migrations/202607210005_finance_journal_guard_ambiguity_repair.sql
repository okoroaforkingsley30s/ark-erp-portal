-- Resolve the journal_no PL/pgSQL variable/column collision that prevents
-- Finance from completing payments and disbursements.

create or replace function public.finance_guard_posted_journal_lines()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_journal_status text;
  v_journal_no text;
  v_target_journal_id uuid;
begin
  v_target_journal_id := case
    when tg_op = 'DELETE' then old.journal_id
    else new.journal_id
  end;

  select
    journal.status,
    journal.journal_no
  into
    v_journal_status,
    v_journal_no
  from public.finance_journals as journal
  where journal.id = v_target_journal_id;

  if v_journal_status = 'posted' then
    raise exception
      'Posted journal % lines cannot be edited directly. Use a reversal or adjustment journal.',
      v_journal_no;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.finance_guard_posted_journal_lines()
  from public, anon, authenticated;

comment on function public.finance_guard_posted_journal_lines() is
  'Protects posted journal lines using qualified columns and collision-safe local variable names.';