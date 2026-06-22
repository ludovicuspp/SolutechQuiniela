-- ============================================
-- Seed: Premios SolutechQuiniela
-- SolutechQuiniela 2026 - Solutech Group
-- Run this in Supabase SQL Editor
-- ============================================

-- Limpiar premios existentes (opcional)
-- DELETE FROM public.prizes;

INSERT INTO public.prizes (fase, posicion, titulo, descripcion) VALUES

-- ============================================
-- FASE DE GRUPOS
-- ============================================
('grupo', 1,
  '🥇 Camisa Oficial FIFA 2026',
  'Camisa oficial del Mundial FIFA 2026 con tu nombre y número personalizado'),
('grupo', 2,
  '🥈 Kit Solutech Premium',
  'Kit completo Solutech: camiseta, gorra y termo oficial de la marca'),
('grupo', 3,
  '🥉 Bono Solutech $25',
  'Bono de $25 USD en productos del catálogo Solutech'),

-- ============================================
-- OCTAVOS DE FINAL
-- ============================================
('octavos', 1,
  '🥇 Smart TV 32" Samsung',
  'Televisor Samsung 32 pulgadas Smart TV Full HD, entregado en tu zona'),
('octavos', 2,
  '🥈 Camisa Oficial FIFA 2026',
  'Camisa oficial del Mundial FIFA 2026 con tu nombre y número personalizado'),
('octavos', 3,
  '🥉 Kit Solutech Premium',
  'Kit completo Solutech: camiseta, gorra y termo oficial de la marca'),

-- ============================================
-- CUARTOS DE FINAL
-- ============================================
('cuartos', 1,
  '🥇 Bono Efectivo $100 USD',
  'Cien dólares en efectivo entregados directamente al ganador'),
('cuartos', 2,
  '🥈 Smart TV 32" Samsung',
  'Televisor Samsung 32 pulgadas Smart TV Full HD, entregado en tu zona'),
('cuartos', 3,
  '🥉 Camisa Oficial FIFA 2026',
  'Camisa oficial del Mundial FIFA 2026 con tu nombre y número personalizado'),

-- ============================================
-- SEMIFINAL
-- ============================================
('semifinal', 1,
  '🥇 Bono Efectivo $200 USD',
  'Doscientos dólares en efectivo entregados directamente al ganador'),
('semifinal', 2,
  '🥈 Bono Efectivo $100 USD',
  'Cien dólares en efectivo entregados directamente al ganador'),
('semifinal', 3,
  '🥉 Smart TV 32" Samsung',
  'Televisor Samsung 32 pulgadas Smart TV Full HD, entregado en tu zona'),

-- ============================================
-- TERCER PUESTO
-- ============================================
('tercer_puesto', 1,
  '🥇 Bono Efectivo $150 USD',
  'Ciento cincuenta dólares en efectivo entregados directamente al ganador'),
('tercer_puesto', 2,
  '🥈 Kit Solutech Premium + Bono $50',
  'Kit Solutech completo más bono de $50 USD en productos'),
('tercer_puesto', 3,
  '🥉 Kit Solutech Premium',
  'Kit completo Solutech: camiseta, gorra y termo oficial de la marca'),

-- ============================================
-- FINAL (Ranking Global)
-- ============================================
('final', 1,
  '💸 1° Lugar',
  '$100 en efectivo para el campeón del ranking global'),
('final', 2,
  '🍽️ 2° Lugar',
  'Cena para dos personas'),
('final', 3,
  '🍿 3° Lugar',
  'Entrada de cine para 2 personas con combo incluido'),
('final', 4,
  '🎟️ 4° Lugar',
  'Entrada de cine'),
('final', 5,
  '🎟️ 5° Lugar',
  'Entrada de cine');
