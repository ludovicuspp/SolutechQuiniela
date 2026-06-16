-- Add dieciseisavos (Round of 32) to matches.fase CHECK constraint
-- 48-team World Cup 2026 format: grupos → dieciseisavos → octavos → cuartos → semifinal → tercer_puesto → final
alter table public.matches drop constraint if exists matches_fase_check;
alter table public.matches add constraint matches_fase_check
  check (fase in ('grupo', 'repechaje', 'dieciseisavos', 'octavos', 'cuartos', 'semifinal', 'tercer_puesto', 'final'));
