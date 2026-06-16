create or replace function public.public_admin_get_user_transactions(p_user_id uuid)
returns table (
  id uuid,
  tipo text,
  monto numeric,
  balance_despues numeric,
  descripcion text,
  referencia text,
  created_at timestamptz
)
language plpgsql security definer as $$
begin
  return query
  select
    t.id,
    t.tipo,
    t.monto,
    t.balance_despues,
    t.descripcion,
    t.referencia,
    t.created_at
  from public.wallet_transactions t
  where t.user_id = p_user_id
  order by t.created_at desc
  limit 100;
end;
$$;

grant execute on function public.public_admin_get_user_transactions(uuid) to anon, authenticated;