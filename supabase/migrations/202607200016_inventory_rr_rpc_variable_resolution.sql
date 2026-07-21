-- Resolve legacy PL/pgSQL variable/column name collisions in the atomic
-- Inventory -> RR handoff RPC (notably part_number and part_name).
-- pg_get_functiondef preserves the complete previously deployed transaction;
-- this migration adds PostgreSQL's supported per-function compiler directive.

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.inventory_send_part_to_rr(uuid)'::regprocedure
  ) into function_definition;

  if function_definition is null then
    raise exception 'inventory_send_part_to_rr(uuid) was not found';
  end if;

  if position('#variable_conflict use_variable' in function_definition) = 0 then
    function_definition := regexp_replace(
      function_definition,
      '(AS[[:space:]]+\$function\$[[:space:]]*)',
      E'\\1#variable_conflict use_variable\n',
      'i'
    );
  end if;

  if position('#variable_conflict use_variable' in function_definition) = 0 then
    raise exception 'Could not add variable-conflict directive to Inventory RR function';
  end if;

  execute function_definition;
end
$migration$;

revoke all on function public.inventory_send_part_to_rr(uuid) from public, anon;
grant execute on function public.inventory_send_part_to_rr(uuid) to authenticated;
