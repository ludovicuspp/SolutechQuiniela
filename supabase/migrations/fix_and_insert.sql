-- ============================================================
-- 1. Fix: recrear public_admin_create_user (versión correcta)
-- ============================================================
create or replace function public.public_admin_create_user(
  p_email text, p_password text, p_rif text, p_nombre text,
  p_telefono text default '', p_zona text default '',
  p_vendedor text default '', p_empresa text default '',
  p_puntos numeric default 0, p_is_admin boolean default false
) returns uuid language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_wallet_id uuid;
begin
  select id into v_user_id from auth.users where email = p_email limit 1;
  if v_user_id is null then
    v_user_id := extensions.uuid_generate_v4();
    insert into auth.users (
      instance_id, id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_confirm_status
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated',
      p_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('nombre', p_nombre, 'rif', p_rif),
      now(), now(),
      '', '', '', '', 0
    );
  end if;
  insert into public.users (id, rif, nombre, telefono, zona, vendedor, empresa, telefono_verificado, is_admin)
  values (v_user_id, p_rif, p_nombre, public.normalize_phone_ve(p_telefono), p_zona, p_vendedor, p_empresa, true, p_is_admin)
  on conflict (id) do nothing;
  insert into public.wallets (user_id, balance, total_earned) values (v_user_id, p_puntos, p_puntos) on conflict (user_id) do nothing;
  if p_puntos > 0 then
    select id into v_wallet_id from public.wallets where user_id = v_user_id;
    insert into public.wallet_transactions (wallet_id, user_id, tipo, monto, balance_despues, descripcion, referencia)
    values (v_wallet_id, v_user_id, 'compra', p_puntos, p_puntos, 'Puntos iniciales por administrador', 'admin_created');
  end if;
  return v_user_id;
end;
$$;

grant execute on function public.public_admin_create_user(text, text, text, text, text, text, text, text, numeric, boolean) to anon, authenticated;

-- ============================================================
-- 2. Bulk insert: 58 empleados
-- ============================================================
do $$
begin
  perform public_admin_create_user('10438552@solutechquiniela.app', '12345678', 'V10438552', 'Francis Rodriguez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('9767493@solutechquiniela.app', '12345678', 'V9767493', 'Ali Fuenmayor', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('23554136@solutechquiniela.app', '12345678', 'V23554136', 'Willkar Prieto', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('18649481@solutechquiniela.app', '12345678', 'V18649481', 'Maryolis Robles', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('22475195@solutechquiniela.app', '12345678', 'V22475195', 'Yelitza Escandela', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('30465174@solutechquiniela.app', '12345678', 'V30465174', 'Andres Garcia', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('25790287@solutechquiniela.app', '12345678', 'V25790287', 'Carlos Cardenas', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('30262082@solutechquiniela.app', '12345678', 'V30262082', 'Diego Pulido', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('15443378@solutechquiniela.app', '12345678', 'V15443378', 'Elida Pirela', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('27418371@solutechquiniela.app', '12345678', 'V27418371', 'Steven Riquet', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('16018130@solutechquiniela.app', '12345678', 'V16018130', 'Nestor Jimenez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('15720651@solutechquiniela.app', '12345678', 'V15720651', 'Dannierit Rodriguez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('10718181@solutechquiniela.app', '12345678', 'V10718181', 'William Prieto', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('23768751@solutechquiniela.app', '12345678', 'V23768751', 'Daniel Fornez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('23445710@solutechquiniela.app', '12345678', 'V23445710', 'Javier Pirela', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('17232307@solutechquiniela.app', '12345678', 'V17232307', 'Jean Briñez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('12404011@solutechquiniela.app', '12345678', 'V12404011', 'Elvis Labarca', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('6833617@solutechquiniela.app', '12345678', 'V6833617', 'Rafael Tinedo', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('19570819@solutechquiniela.app', '12345678', 'V19570819', 'Yoelig Gutierrez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('13235641@solutechquiniela.app', '12345678', 'V13235641', 'Jhonny Chirivella', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('25339358@solutechquiniela.app', '12345678', 'V25339358', 'Paola Garcia', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('7830438@solutechquiniela.app', '12345678', 'V7830438', 'Nancy Borges', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('15156951@solutechquiniela.app', '12345678', 'V15156951', 'Wilmer Pulido', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('17613411@solutechquiniela.app', '12345678', 'V17613411', 'Maria Vargas', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('14206915@solutechquiniela.app', '12345678', 'V14206915', 'Elvis Medina', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('13574682@solutechquiniela.app', '12345678', 'V13574682', 'Miky Valero', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('20208131@solutechquiniela.app', '12345678', 'V20208131', 'Robert Beleño', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('13073966@solutechquiniela.app', '12345678', 'V13073966', 'Henrry Freitez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('30036645@solutechquiniela.app', '12345678', 'V30036645', 'Victor Andueza', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('16746940@solutechquiniela.app', '12345678', 'V16746940', 'Michael Mendez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('5378987@solutechquiniela.app', '12345678', 'V5378987', 'Gerardo Romero', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('15860788@solutechquiniela.app', '12345678', 'V15860788', 'Humberto Vargas', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('24971702@solutechquiniela.app', '12345678', 'V24971702', 'Eliacni Freitez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('10438403@solutechquiniela.app', '12345678', 'V10438403', 'Jose Medina', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('11528899@solutechquiniela.app', '12345678', 'V11528899', 'Carmen Guerra', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('23440321@solutechquiniela.app', '12345678', 'V23440321', 'Eduardo Lovera', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('13715288@solutechquiniela.app', '12345678', 'V13715288', 'Tomasa Vargas', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('27886986@solutechquiniela.app', '12345678', 'V27886986', 'Mariannys Dale', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('10454198@solutechquiniela.app', '12345678', 'V10454198', 'Marisol Machado', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('19547892@solutechquiniela.app', '12345678', 'V19547892', 'Francia Cova', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('7771416@solutechquiniela.app', '12345678', 'V7771416', 'Maitee Lam', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('7547682@solutechquiniela.app', '12345678', 'V7547682', 'Amador Colmenarez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('12867796@solutechquiniela.app', '12345678', 'V12867796', 'Samir Willies', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('7527322@solutechquiniela.app', '12345678', 'V7527322', 'Carmen Lopez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('15163294@solutechquiniela.app', '12345678', 'V15163294', 'Yasser Cataño', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('6831767@solutechquiniela.app', '12345678', 'V6831767', 'Luis Oliveros', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('4995165@solutechquiniela.app', '12345678', 'V4995165', 'Abdel Iriarte', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('18986549@solutechquiniela.app', '12345678', 'V18986549', 'Diego Hernandez', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('23763361@solutechquiniela.app', '12345678', 'V23763361', 'Lina Leon', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('21360355@solutechquiniela.app', '12345678', 'V21360355', 'Yajaira Duran', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('27418968@solutechquiniela.app', '12345678', 'V27418968', 'Nelson Dugarte', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('36465474@solutechquiniela.app', '12345678', 'V36465474', 'Luis Alberto Oliveros', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('17085001@solutechquiniela.app', '12345678', 'V17085001', 'Marcos Bencomo', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('12949834@solutechquiniela.app', '12345678', 'V12949834', 'Karina Avila', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('12381515@solutechquiniela.app', '12345678', 'V12381515', 'Luis Urdaneta', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('9786538@solutechquiniela.app', '12345678', 'V9786538', 'Gustavo Cedeño', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('7961375@solutechquiniela.app', '12345678', 'V7961375', 'Orlando Garcia', '', '', '', 'Solutech', 1000, false);
  perform public_admin_create_user('10080220@solutechquiniela.app', '12345678', 'V10080220', 'Nathaly Garcia', '', '', '', 'Solutech', 1000, false);
end;
$$;

-- ============================================================
-- 3. Verificación
-- ============================================================
select rif, nombre, empresa, is_admin, created_at
from public.users
where rif in ('V10438552', 'V9767493', 'V23554136', 'V18649481', 'V22475195', 'V30465174', 'V25790287', 'V30262082', 'V15443378', 'V27418371', 'V16018130', 'V15720651', 'V10718181', 'V23768751', 'V23445710', 'V17232307', 'V12404011', 'V6833617', 'V19570819', 'V13235641', 'V25339358', 'V7830438', 'V15156951', 'V17613411', 'V14206915', 'V13574682', 'V20208131', 'V13073966', 'V30036645', 'V16746940', 'V5378987', 'V15860788', 'V24971702', 'V10438403', 'V11528899', 'V23440321', 'V13715288', 'V27886986', 'V10454198', 'V19547892', 'V7771416', 'V7547682', 'V12867796', 'V7527322', 'V15163294', 'V6831767', 'V4995165', 'V18986549', 'V23763361', 'V21360355', 'V27418968', 'V36465474', 'V17085001', 'V12949834', 'V12381515', 'V9786538', 'V7961375', 'V10080220')
order by created_at;
