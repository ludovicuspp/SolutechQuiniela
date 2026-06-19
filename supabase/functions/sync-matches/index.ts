import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

const API_BASE = "https://v3.football.api-sports.io";

const STATUS_MAP: Record<string, string> = {
  TBD: "programado",
  NS: "programado",
  "1H": "en_juego",
  HT: "en_juego",
  "2H": "en_juego",
  ET: "en_juego",
  BT: "en_juego",
  P: "en_juego",
  SUSP: "suspendido",
  INT: "suspendido",
  FT: "finalizado",
  AET: "finalizado",
  PEN: "finalizado",
  CANC: "suspendido",
  ABD: "suspendido",
  AWD: "finalizado",
  WO: "finalizado",
};

function mapFase(round: string): string {
  if (!round) return "grupo";
  const n = round.toLowerCase();
  if (n.includes("group")) return "grupo";
  if (n.includes("round of 32")) return "dieciseisavos";
  if (n.includes("round of 16")) return "octavos";
  if (n.includes("quarter")) return "cuartos";
  if (n.includes("semi")) return "semifinal";
  if (n.includes("third")) return "tercer_puesto";
  if (n.includes("final")) return "final";
  return "grupo";
}

interface StandingTeam {
  team: { id: number; name: string; logo: string };
  group: string;
}

interface StandingsResponse {
  response: Array<{
    league: {
      standings: Array<Array<StandingTeam>>;
    };
  }>;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const apiKey = Deno.env.get("FOOTBALL_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "FOOTBALL_API_KEY no configurada" }, { status: 500 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // 1. Fetch standings → build teamId → grupo (A..L) map
    const grupoByTeam: Record<number, string> = {};
    try {
      const standRes = await fetchWithTimeout(
        `${API_BASE}/standings?league=1&season=2026`,
        { headers: { "x-apisports-key": apiKey } }
      );
      if (standRes.ok) {
        const standData: StandingsResponse = await standRes.json();
        const groups = standData.response?.[0]?.league?.standings?.[0];
        if (groups) {
          for (const team of groups) {
            if (team.team?.id && team.group) {
              grupoByTeam[team.team.id] = team.group.replace(/^Group\s*/i, "").trim();
            }
          }
        }
      }
    } catch (e) {
      console.warn("No se pudo obtener standings:", e);
    }

    // 2. Fetch all fixtures (handle pagination — free plan doesn't support ?page=)
    const firstRes = await fetchWithTimeout(
      `${API_BASE}/fixtures?league=1&season=2026`,
      { headers: { "x-apisports-key": apiKey } }
    );
    if (!firstRes.ok) {
      throw new Error(`Football API error ${firstRes.status}`);
    }
    const firstData = await firstRes.json();
    const allFixtures: any[] = [...(firstData.response || [])];
    const totalPages = firstData.paging?.total || 1;

    // Try subsequent pages (may fail on free plan)
    for (let p = 2; p <= totalPages; p++) {
      try {
        const pageRes = await fetchWithTimeout(
          `${API_BASE}/fixtures?league=1&season=2026&page=${p}`,
          { headers: { "x-apisports-key": apiKey } },
          8000
        );
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          allFixtures.push(...(pageData.response || []));
        }
      } catch {
        break; // pagination not supported (free plan)
      }
    }

    const fixtures = allFixtures;
    if (fixtures.length === 0) {
      return Response.json({ count: 0, enJuego: 0, finalizados: 0 });
    }

    // 3. Map fixtures
    const mappedMatches = fixtures.map((f) => {
      const estado = STATUS_MAP[f.fixture?.status?.short] || "programado";
      const homeId = f.teams?.home?.id;
      const awayId = f.teams?.away?.id;
      const grupo =
        grupoByTeam[homeId] && grupoByTeam[homeId] === grupoByTeam[awayId]
          ? grupoByTeam[homeId]
          : null;

      return {
        external_id: f.fixture.id,
        fase: mapFase(f.league?.round),
        grupo,
        jornada: null,
        equipo_local: f.teams?.home?.name || "Local",
        equipo_visitante: f.teams?.away?.name || "Visitante",
        codigo_local: null,
        codigo_visitante: null,
        bandera_local: f.teams?.home?.logo || null,
        bandera_visitante: f.teams?.away?.logo || null,
        sede: f.fixture?.venue?.name || null,
        fecha_partido: f.fixture?.date,
        goles_local: f.goals?.home ?? null,
        goles_visitante: f.goals?.away ?? null,
        estado,
        resultado_verificado: estado === "finalizado",
        apuestas_abiertas: estado === "programado",
      };
    });

    // 4. Upsert via RPC
    const { error: rpcError } = await supabase.rpc("batch_upsert_matches", {
      p_matches: mappedMatches,
    });
    if (rpcError) {
      throw rpcError;
    }

    const enJuego = mappedMatches.filter((m) => m.estado === "en_juego").length;
    const finalizados = mappedMatches.filter(
      (m) => m.estado === "finalizado"
    ).length;

    console.log(
      `[${new Date().toISOString()}] ${mappedMatches.length} partidos → ` +
        `${mappedMatches.filter((m) => m.estado === "programado").length} prog, ${enJuego} en vivo, ${finalizados} finalizados`
    );

    return Response.json(
      { count: mappedMatches.length, enJuego, finalizados },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("[sync-matches] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
