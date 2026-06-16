-- Delete all matches with stale external_ids (non-API-Football)
-- This removes matches from the old Sportmonks integration
delete from public.matches
where external_id is not null
  and external_id not in (
    select (item->>'external_id')::int
    from jsonb_array_elements(
      '[PLACEHOLDER]'::jsonb
    ) as item
  );
