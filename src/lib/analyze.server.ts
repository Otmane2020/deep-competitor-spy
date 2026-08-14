import {
  competitorsForDomain,
  rankedKeywords,
  searchVolume,
  type DfsCompetitor,
  type VolumeRow,
} from "./dataforseo.server";

export type PageInfo = {
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  headings: string[];
  wordCount: number;
  topTerms: string[];
  canonical: string;
};

export type AnalysisResult = {
  site: { url: string; domain: string; title: string; description: string; lang: string };
  pages: PageInfo[];
  competitors: { name: string; domain: string; why: string }[];
  dfsCompetitors: DfsCompetitor[];
  keywords: {
    keyword: string;
    intent: string;
    difficulty: "low" | "medium" | "high";
    why: string;
    volume: number | null;
    cpc: number | null;
    competition: number | null;
  }[];
  rankedKeywords: VolumeRow[];
  articleBriefs: {
    title: string;
    targetKeyword: string;
    angle: string;
    outline: string[];
    questions: string[];
    entities: string[];
  }[];
  notes: string[];
};

const STOPWORDS = new Set(
  `le la les de des du un une et en pour avec sur dans par au aux ce cette ces est sont votre vos notre nos plus tout tous sans qui que quoi dont chez son sa ses il elle nous vous ils elles the and for with your you our from this that are was will can all not have has how what why
`
    .split(/\s+/)
    .filter(Boolean),
);

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(re: RegExp, html: string) {
  const m = html.match(re);
  return m?.[1] ? m[1].trim() : "";
}

function topTerms(text: string, limit = 15) {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-zàâäéèêëîïôöùûüç]{4,}/g) ?? []) {
    if (STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; SeoScoutBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    return { html: await res.text(), finalUrl: res.url || url };
  } catch (e) {
    console.error("fetchPage failed", url, (e as Error).message);
    return null;
  }
}

function parsePage(html: string, url: string): PageInfo {
  const text = stripHtml(html);
  return {
    url,
    title:
      pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html) ||
      pick(/property=["']og:title["'][^>]*content=["']([^"']*)["']/i, html),
    metaDescription:
      pick(/name=["']description["'][^>]*content=["']([^"']*)["']/i, html) ||
      pick(/property=["']og:description["'][^>]*content=["']([^"']*)["']/i, html),
    h1: stripHtml(pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html)),
    headings: [...html.matchAll(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi)]
      .map((m) => stripHtml(m[1] ?? ""))
      .filter(Boolean)
      .slice(0, 20),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    topTerms: topTerms(text),
    canonical: pick(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i, html),
  };
}

function internalLinks(html: string, origin: string, max: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    const href = m[1];
    if (!href) continue;
    let abs: URL;
    try {
      abs = new URL(href, origin);
    } catch {
      continue;
    }
    if (abs.origin !== new URL(origin).origin) continue;
    if (/\.(pdf|jpg|png|svg|zip|webp|gif|mp4)$/i.test(abs.pathname)) continue;
    abs.hash = "";
    const key = abs.toString();
    if (seen.has(key) || key === origin) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= max) break;
  }
  return out;
}

export async function scrapeSite(rawUrl: string) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const home = await fetchPage(url);
  if (!home) throw new Error(`Impossible de charger ${url} (site injoignable, bloqué ou trop lent).`);

  const lang = pick(/<html[^>]*lang=["']([^"']+)["']/i, home.html) || "fr";
  const homeInfo = parsePage(home.html, home.finalUrl);
  const links = internalLinks(home.html, home.finalUrl, 5);

  const others = await Promise.all(
    links.map(async (l) => {
      const p = await fetchPage(l);
      return p ? parsePage(p.html, p.finalUrl) : null;
    }),
  );

  return {
    url: home.finalUrl,
    domain: new URL(home.finalUrl).hostname.replace(/^www\./, ""),
    lang,
    pages: [homeInfo, ...others.filter((p): p is PageInfo => p !== null)],
    text: stripHtml(home.html).slice(0, 6000),
  };
}

type Scraped = Awaited<ReturnType<typeof scrapeSite>>;

async function askDeepSeek(scraped: Scraped, apiKey: string) {
  const pagesDigest = scraped.pages
    .map(
      (p) =>
        `- ${p.url}\n  title: ${p.title}\n  meta: ${p.metaDescription}\n  h1: ${p.h1}\n  h2/h3: ${p.headings.slice(0, 8).join(" | ")}\n  termes: ${p.topTerms.join(", ")}`,
    )
    .join("\n");

  const prompt = `Analyse SEO de ${scraped.domain}.

Pages analysées :
${pagesDigest}

Extrait du contenu : ${scraped.text}

Réponds en JSON strict, en français :
{
 "site": {"title": string, "description": string},
 "competitors": [{"name": string, "domain": string, "why": string}],   // exactement 5 concurrents réels
 "keywords": [{"keyword": string, "intent": string, "difficulty": "low"|"medium"|"high", "why": string}], // 12 mots-clés
 "articleBriefs": [{"title": string, "targetKeyword": string, "angle": string, "outline": [string], "questions": [string], "entities": [string]}] // 3 briefs d'articles prêts pour un moteur de génération
}`;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Tu es un expert SEO. Tu réponds uniquement en JSON valide." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (res.status === 429) throw new Error("Limite de requêtes DeepSeek atteinte, réessaie.");
  if (res.status === 402) throw new Error("Crédits DeepSeek épuisés.");
  if (!res.ok) throw new Error(`Erreur DeepSeek [${res.status}]: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const json = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(json.slice(json.indexOf("{"), json.lastIndexOf("}") + 1));
}

export async function analyzeSiteFull(rawUrl: string, apiKey: string): Promise<AnalysisResult> {
  const scraped = await scrapeSite(rawUrl);
  const parsed = await askDeepSeek(scraped, apiKey);
  const notes: string[] = [];

  const locationName = scraped.lang.startsWith("fr") ? "France" : "United States";
  const languageName = scraped.lang.startsWith("fr") ? "French" : "English";

  const aiKeywords = (parsed.competitors ? parsed.keywords : parsed.keywords) ?? [];
  const keywordList: string[] = aiKeywords
    .map((k: { keyword?: string }) => k.keyword)
    .filter(Boolean);

  const [volumes, dfsCompetitors, ranked] = await Promise.all([
    searchVolume(keywordList, locationName, languageName).catch((e: Error) => {
      notes.push(`Volumes DataForSEO indisponibles : ${e.message}`);
      return [] as VolumeRow[];
    }),
    competitorsForDomain(scraped.domain, locationName, languageName).catch((e: Error) => {
      notes.push(`Concurrents DataForSEO indisponibles : ${e.message}`);
      return [] as DfsCompetitor[];
    }),
    rankedKeywords(scraped.domain, locationName, languageName).catch(() => [] as VolumeRow[]),
  ]);

  const volumeMap = new Map(volumes.map((v) => [v.keyword.toLowerCase(), v]));

  return {
    site: {
      url: scraped.url,
      domain: scraped.domain,
      title: parsed.site?.title || scraped.pages[0]?.title || scraped.domain,
      description: parsed.site?.description || scraped.pages[0]?.metaDescription || "",
      lang: scraped.lang,
    },
    pages: scraped.pages,
    competitors: (parsed.competitors ?? []).slice(0, 5),
    dfsCompetitors,
    keywords: aiKeywords.slice(0, 12).map((k: Record<string, string>) => {
      const v = volumeMap.get(String(k["keyword"]).toLowerCase());
      return {
        keyword: k["keyword"] ?? "",
        intent: k["intent"] ?? "",
        difficulty: (k["difficulty"] as "low" | "medium" | "high") ?? "medium",
        why: k["why"] ?? "",
        volume: v?.volume ?? null,
        cpc: v?.cpc ?? null,
        competition: v?.competition ?? null,
      };
    }),
    rankedKeywords: ranked,
    articleBriefs: (parsed.articleBriefs ?? []).slice(0, 3),
    notes,
  };
}
