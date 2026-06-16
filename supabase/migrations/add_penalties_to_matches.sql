-- Add penalty shootout columns to matches (nullable; null = no penalties)
alter table public.matches add column if not exists penales_local integer;
alter table public.matches add column if not exists penales_visitante integer;

-- Admin RPC: set/clear penalty scores for a match
create or replace function public.admin_set_penalties(
  p_match_id uuid,
  p_pen_local integer,
  p_pen_visitante integer
) returns void
language plpgsql security definer
as $$
begin
  update public.matches
  set penales_local = p_pen_local,
      penales_visitante = p_pen_visitante,
      updated_at = now()
  where id = p_match_id;

  if not found then
    raise exception 'Partido no encontrado';
  end if;
end;
$$;

grant execute on function public.admin_set_penalties(uuid, integer, integer) to authenticated;
