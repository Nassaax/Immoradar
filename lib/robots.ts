import { logger } from "./logger";

/**
 * Vérification robots.txt minimaliste mais correcte pour notre usage :
 * - récupère /robots.txt une fois par domaine et par run (mis en cache le
 *   temps du process),
 * - sélectionne le groupe de règles le plus spécifique pour notre user-agent
 *   ("ListingRadarBot"), avec repli sur "*",
 *   sur "*",
 * - applique la règle "la plus longue correspondance gagne" (comportement
 *   standard de facto, cf. Google robots.txt spec).
 *
 * En cas d'erreur réseau ou d'absence de robots.txt, on considère l'accès
 * autorisé par défaut (comportement standard : pas de robots.txt = tout permis),
 * mais on log l'incident pour investigation.
 */

const USER_AGENT_NAME = "ListingRadarBot";

type Rule = { path: string; allow: boolean };
type RobotsDoc = { groups: Map<string, Rule[]>; fetchedAt: number };

const cache = new Map<string, RobotsDoc>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

function parseRobotsTxt(text: string): Map<string, Rule[]> {
  const groups = new Map<string, Rule[]>();
  let currentAgents: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const sepIndex = line.indexOf(":");
    if (sepIndex === -1) continue;
    const field = line.slice(0, sepIndex).trim().toLowerCase();
    const value = line.slice(sepIndex + 1).trim();

    if (field === "user-agent") {
      // Une nouvelle ligne user-agent après des règles Allow/Disallow démarre un nouveau groupe.
      const lastAgent = currentAgents[currentAgents.length - 1];
      const alreadyHasRules = lastAgent !== undefined && (groups.get(lastAgent)?.length ?? 0) > 0;
      if (currentAgents.length === 0 || alreadyHasRules) {
        currentAgents = [];
      }
      currentAgents.push(value.toLowerCase());
      for (const agent of currentAgents) {
        if (!groups.has(agent)) groups.set(agent, []);
      }
    } else if (field === "allow" || field === "disallow") {
      if (currentAgents.length === 0) continue;
      const rule: Rule = { path: value, allow: field === "allow" };
      for (const agent of currentAgents) {
        groups.get(agent)?.push(rule);
      }
    }
  }

  return groups;
}

async function getRobotsDoc(origin: string): Promise<RobotsDoc> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  let groups = new Map<string, Rule[]>();
  try {
    const res = await fetch(new URL("/robots.txt", origin), {
      headers: { "User-Agent": `${USER_AGENT_NAME} (+mailto:${process.env.CRAWLER_CONTACT_EMAIL ?? "contact@listingradar.example"})` },
    });
    if (res.ok) {
      groups = parseRobotsTxt(await res.text());
    } else if (res.status !== 404) {
      logger.warn("robots.txt: réponse non-OK", { origin, status: res.status });
    }
  } catch (err) {
    logger.warn("robots.txt: erreur réseau, accès autorisé par défaut", {
      origin,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const doc: RobotsDoc = { groups, fetchedAt: Date.now() };
  cache.set(origin, doc);
  return doc;
}

function matchLength(rulePath: string, targetPath: string): number {
  // Support minimal du wildcard '*' en fin de règle, sinon correspondance de préfixe.
  const pattern = rulePath.endsWith("*") ? rulePath.slice(0, -1) : rulePath;
  return targetPath.startsWith(pattern) ? pattern.length : -1;
}

/** Retourne true si l'URL peut être crawlée selon robots.txt. */
export async function isAllowedByRobots(url: string): Promise<boolean> {
  const target = new URL(url);
  const doc = await getRobotsDoc(target.origin);

  const group =
    doc.groups.get(USER_AGENT_NAME.toLowerCase()) ?? doc.groups.get("*") ?? [];

  if (group.length === 0) return true;

  let best: Rule | null = null;
  let bestLen = -1;
  for (const rule of group) {
    if (!rule.path) continue;
    const len = matchLength(rule.path, target.pathname);
    if (len > bestLen) {
      bestLen = len;
      best = rule;
    }
  }

  return best === null ? true : best.allow;
}
