const BASE = "https://api.dataforseo.com/v3";

export type VolumeRow = {
  keyword: string;
  volume: number | null;
  cpc: number | null;
  competition: number | null;
};

export type DfsCompetitor = {
  domain: string;
  organicKeywords: number | null;
  organicTraffic: number | null;
  intersections: number | null;
};

function authHeader() {
  const login = process.env["DATAFORSEO_LOGIN"];
  const password = process.env["DATAFORSEO_PASSWORD"];
  if (!login || !password) return null;
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

async function call(path: string, payload: unknown) {
  const auth = authHeader();
  if (!auth) throw new Error("Identifiants DataForSEO manquants.");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify([payload]),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`DataForSEO [${res.status}]: ${JSON.stringify(body)?.slice(0, 300)}`);
  const task = body?.tasks?.[0];
  if (task?.status_code && task.status_code >= 40000) {
    throw new Error(`DataForSEO: ${task.status_message}`);
  }
  return task?.result ?? [];
}

export async function searchVolume(
  keywords: string[],
  locationName: string,
  languageName: string,
): Promise<VolumeRow[]> {
  if (keywords.length === 0) return [];
  const result = await call("/keywords_data/google_ads/search_volume/live", {
    keywords: keywords.slice(0, 100),
    location_name: locationName,
    language_name: languageName,
  });
  return (result as Record<string, unknown>[]).map((r) => ({
    keyword: String(r["keyword"] ?? ""),
    volume: (r["search_volume"] as number) ?? null,
    cpc: (r["cpc"] as number) ?? null,
    competition: (r["competition_index"] as number) ?? null,
  }));
}

export async function competitorsForDomain(
  domain: string,
  locationName: string,
  languageName: string,
): Promise<DfsCompetitor[]> {
  const result = await call("/dataforseo_labs/google/competitors_domain/live", {
    target: domain,
    location_name: locationName,
    language_name: languageName,
    limit: 10,
    exclude_top_domains: true,
  });
  const items = ((result as Record<string, unknown>[])[0]?.["items"] ?? []) as Record<
    string,
    unknown
  >[];
  return items
    .filter((i) => String(i["domain"] ?? "") !== domain)
    .slice(0, 5)
    .map((i) => {
      const metrics = (i["metrics"] as Record<string, Record<string, number>>)?.["organic"];
      return {
        domain: String(i["domain"] ?? ""),
        organicKeywords: metrics?.["count"] ?? null,
        organicTraffic: metrics?.["etv"] != null ? Math.round(metrics["etv"]) : null,
        intersections: (i["intersections"] as number) ?? null,
      };
    });
}

export async function rankedKeywords(
  domain: string,
  locationName: string,
  languageName: string,
): Promise<VolumeRow[]> {
  const result = await call("/dataforseo_labs/google/ranked_keywords/live", {
    target: domain,
    location_name: locationName,
    language_name: languageName,
    limit: 20,
    order_by: ["keyword_data.keyword_info.search_volume,desc"],
  });
  const items = ((result as Record<string, unknown>[])[0]?.["items"] ?? []) as Record<
    string,
    unknown
  >[];
  return items.map((i) => {
    const kd = i["keyword_data"] as Record<string, unknown> | undefined;
    const info = kd?.["keyword_info"] as Record<string, number> | undefined;
    return {
      keyword: String(kd?.["keyword"] ?? ""),
      volume: info?.["search_volume"] ?? null,
      cpc: info?.["cpc"] ?? null,
      competition: info?.["competition"] != null ? Math.round(info["competition"] * 100) : null,
    };
  });
}
