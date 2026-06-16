-- ============================================
-- Cleanup old matches (Sportmonks leftovers)
-- Call with list of valid API-Football IDs
-- ============================================
create or replace function public.cleanup_old_matches(p_valid_ids int[])
returns int
language plpgsql security definer
as $$
declare
  v_count int;
begin
  delete from public.matches
  where external_id is not null
    and external_id != all(coalesce(p_valid_ids, array[]::int[]));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
