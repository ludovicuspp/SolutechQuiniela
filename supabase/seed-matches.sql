-- ============================================
-- Seed: Partidos del Mundial FIFA 2026
-- Fase de Grupos - Jornada 1 (Seleccion de partidos)
-- NOTA: Este es un fixture PARCIAL de ejemplo.
-- Los partidos reales se actualizaran via API.
-- ============================================

-- Grupo A
INSERT INTO public.matches (fase, grupo, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('grupo', 'A', 1, 'Mexico', 'Canada', '2026-06-11T17:00:00Z', 'Estadio Azteca, CDMX', 'programado', true),
('grupo', 'A', 1, 'USA', 'Colombia', '2026-06-11T20:00:00Z', 'SoFi Stadium, Los Angeles', 'programado', true),
('grupo', 'A', 2, 'Mexico', 'Colombia', '2026-06-15T17:00:00Z', 'Estadio Azteca, CDMX', 'programado', true),
('grupo', 'A', 2, 'Canada', 'USA', '2026-06-15T20:00:00Z', 'BMO Field, Toronto', 'programado', true),
('grupo', 'A', 3, 'Colombia', 'Canada', '2026-06-19T17:00:00Z', 'MetLife Stadium, New Jersey', 'programado', true),
('grupo', 'A', 3, 'USA', 'Mexico', '2026-06-19T20:00:00Z', 'AT&T Stadium, Dallas', 'programado', true);

-- Grupo B
INSERT INTO public.matches (fase, grupo, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('grupo', 'B', 1, 'Argentina', 'Peru', '2026-06-12T14:00:00Z', 'Hard Rock Stadium, Miami', 'programado', true),
('grupo', 'B', 1, 'Alemania', 'Japon', '2026-06-12T17:00:00Z', 'MetLife Stadium, New Jersey', 'programado', true),
('grupo', 'B', 2, 'Argentina', 'Alemania', '2026-06-16T20:00:00Z', 'AT&T Stadium, Dallas', 'programado', true),
('grupo', 'B', 2, 'Peru', 'Japon', '2026-06-16T14:00:00Z', 'Lincoln Financial Field, Philadelphia', 'programado', true),
('grupo', 'B', 3, 'Japon', 'Argentina', '2026-06-20T17:00:00Z', 'NRG Stadium, Houston', 'programado', true),
('grupo', 'B', 3, 'Alemania', 'Peru', '2026-06-20T17:00:00Z', 'Hard Rock Stadium, Miami', 'programado', true);

-- Grupo C
INSERT INTO public.matches (fase, grupo, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('grupo', 'C', 1, 'Brasil', 'Marruecos', '2026-06-12T20:00:00Z', 'SoFi Stadium, Los Angeles', 'programado', true),
('grupo', 'C', 1, 'Francia', 'Australia', '2026-06-13T14:00:00Z', 'Lumen Field, Seattle', 'programado', true),
('grupo', 'C', 2, 'Brasil', 'Francia', '2026-06-17T20:00:00Z', 'MetLife Stadium, New Jersey', 'programado', true),
('grupo', 'C', 2, 'Marruecos', 'Australia', '2026-06-17T14:00:00Z', 'BC Place, Vancouver', 'programado', true),
('grupo', 'C', 3, 'Australia', 'Brasil', '2026-06-21T17:00:00Z', 'NRG Stadium, Houston', 'programado', true),
('grupo', 'C', 3, 'Francia', 'Marruecos', '2026-06-21T17:00:00Z', 'SoFi Stadium, Los Angeles', 'programado', true);

-- Grupo D
INSERT INTO public.matches (fase, grupo, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('grupo', 'D', 1, 'Espana', 'Ecuador', '2026-06-13T17:00:00Z', 'Guadalajara, Mexico', 'programado', true),
('grupo', 'D', 1, 'Inglaterra', 'Senegal', '2026-06-13T20:00:00Z', 'Levi Stadium, San Francisco', 'programado', true),
('grupo', 'D', 2, 'Espana', 'Inglaterra', '2026-06-18T20:00:00Z', 'AT&T Stadium, Dallas', 'programado', true),
('grupo', 'D', 2, 'Ecuador', 'Senegal', '2026-06-18T14:00:00Z', 'Guadalajara, Mexico', 'programado', true),
('grupo', 'D', 3, 'Senegal', 'Espana', '2026-06-22T17:00:00Z', 'Hard Rock Stadium, Miami', 'programado', true),
('grupo', 'D', 3, 'Inglaterra', 'Ecuador', '2026-06-22T17:00:00Z', 'Levi Stadium, San Francisco', 'programado', true);

-- Grupo E
INSERT INTO public.matches (fase, grupo, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('grupo', 'E', 1, 'Portugal', 'Nigeria', '2026-06-14T14:00:00Z', 'Lincoln Financial Field, Philadelphia', 'programado', true),
('grupo', 'E', 1, 'Paises Bajos', 'Corea del Sur', '2026-06-14T17:00:00Z', 'Lumen Field, Seattle', 'programado', true),
('grupo', 'E', 2, 'Portugal', 'Paises Bajos', '2026-06-19T14:00:00Z', 'MetLife Stadium, New Jersey', 'programado', true),
('grupo', 'E', 2, 'Nigeria', 'Corea del Sur', '2026-06-19T17:00:00Z', 'Guadalajara, Mexico', 'programado', true),
('grupo', 'E', 3, 'Corea del Sur', 'Portugal', '2026-06-23T17:00:00Z', 'SoFi Stadium, Los Angeles', 'programado', true),
('grupo', 'E', 3, 'Paises Bajos', 'Nigeria', '2026-06-23T17:00:00Z', 'Lincoln Financial Field, Philadelphia', 'programado', true);

-- Grupo F
INSERT INTO public.matches (fase, grupo, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('grupo', 'F', 1, 'Italia', 'Uruguay', '2026-06-14T20:00:00Z', 'BMO Field, Toronto', 'programado', true),
('grupo', 'F', 1, 'Belgica', 'Venezuela', '2026-06-15T14:00:00Z', 'BC Place, Vancouver', 'programado', true),
('grupo', 'F', 2, 'Italia', 'Belgica', '2026-06-20T20:00:00Z', 'MetLife Stadium, New Jersey', 'programado', true),
('grupo', 'F', 2, 'Uruguay', 'Venezuela', '2026-06-20T14:00:00Z', 'Hard Rock Stadium, Miami', 'programado', true),
('grupo', 'F', 3, 'Venezuela', 'Italia', '2026-06-24T17:00:00Z', 'NRG Stadium, Houston', 'programado', true),
('grupo', 'F', 3, 'Belgica', 'Uruguay', '2026-06-24T17:00:00Z', 'BMO Field, Toronto', 'programado', true);

-- Octavos de Final (placeholder - se actualizan al finalizar grupos)
INSERT INTO public.matches (fase, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('octavos', 1, '1A', '2B', '2026-06-28T17:00:00Z', 'MetLife Stadium, New Jersey', 'programado', false),
('octavos', 2, '1B', '2A', '2026-06-28T20:00:00Z', 'AT&T Stadium, Dallas', 'programado', false),
('octavos', 3, '1C', '2D', '2026-06-29T17:00:00Z', 'SoFi Stadium, Los Angeles', 'programado', false),
('octavos', 4, '1D', '2C', '2026-06-29T20:00:00Z', 'Hard Rock Stadium, Miami', 'programado', false),
('octavos', 5, '1E', '2F', '2026-06-30T17:00:00Z', 'Lumen Field, Seattle', 'programado', false),
('octavos', 6, '1F', '2E', '2026-06-30T20:00:00Z', 'NRG Stadium, Houston', 'programado', false);

-- Cuartos de Final
INSERT INTO public.matches (fase, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('cuartos', 1, 'QF1', 'QF2', '2026-07-04T17:00:00Z', 'MetLife Stadium, New Jersey', 'programado', false),
('cuartos', 2, 'QF3', 'QF4', '2026-07-04T20:00:00Z', 'SoFi Stadium, Los Angeles', 'programado', false),
('cuartos', 3, 'QF5', 'QF6', '2026-07-05T17:00:00Z', 'AT&T Stadium, Dallas', 'programado', false);

-- Semifinales
INSERT INTO public.matches (fase, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('semifinal', 1, 'SF1', 'SF2', '2026-07-08T20:00:00Z', 'AT&T Stadium, Dallas', 'programado', false),
('semifinal', 2, 'SF3', 'SF4', '2026-07-09T20:00:00Z', 'MetLife Stadium, New Jersey', 'programado', false);

-- Tercer Puesto
INSERT INTO public.matches (fase, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('tercer_puesto', 1, 'Perdedor SF1', 'Perdedor SF2', '2026-07-18T17:00:00Z', 'Hard Rock Stadium, Miami', 'programado', false);

-- FINAL
INSERT INTO public.matches (fase, jornada, equipo_local, equipo_visitante, fecha_partido, sede, estado, apuestas_abiertas) VALUES
('final', 1, 'Ganador SF1', 'Ganador SF2', '2026-07-19T17:00:00Z', 'MetLife Stadium, New Jersey', 'programado', false);
