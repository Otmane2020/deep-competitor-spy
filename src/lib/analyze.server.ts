export type AnalysisResult = {
  site: { url: string; title: string; description: string };
  competitors: { name: string; domain: string; why: string }[];
  keywords: { keyword: string; intent: string; difficulty: "low" | "medium" | "high"; why: string }[];
};

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(re: RegExp, html: string) {
  const m = html.match(re);
  return m?.[1] ? m[1].trim() : "";
}

export async function scrapeSite(rawUrl: string) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; SeoScoutBot/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Impossible de charger la page (${res.status})`);
  const html = await res.text();

  const title =
    pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html) ||
    pick(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i, html);
  const description =
    pick(/name=["']description["'][^>]*content=["']([^"']+)["']/i, html) ||
    pick(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i, html);
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => stripHtml(m[1] ?? ""))
    .filter(Boolean)
    .slice(0, 25);
  const text = stripHtml(html).slice(0, 6000);

  return { url, title, description, headings, text };
}

export async function analyzeWithAI(
  scraped: Awaited<ReturnType<typeof scrapeSite>>,
  apiKey: string,
): Promise<AnalysisResult> {
  const prompt = `Analyse ce site web et réponds en JSON strict.

URL: ${scraped.url}
Titre: ${scraped.title}
Description: ${scraped.description}
Titres (h1-h3): ${scraped.headings.join(" | ")}
Contenu: ${scraped.text}

Donne EXACTEMENT 5 concurrents réels et 8 meilleurs mots-clés SEO à cibler.
Format JSON: {"site":{"title":string,"description":string},"competitors":[{"name":string,"domain":string,"why":string}],"keywords":[{"keyword":string,"intent":string,"difficulty":"low"|"medium"|"high","why":string}]}
Réponds uniquement avec le JSON, en français.`;

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

  if (res.status === 429) throw new Error("Limite de requêtes atteinte, réessaie dans un instant.");
  if (res.status === 402) throw new Error("Crédits DeepSeek épuisés.");
  if (!res.ok) throw new Error(`Erreur DeepSeek [${res.status}]: ${await res.text()}`);

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const json = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(json.slice(json.indexOf("{"), json.lastIndexOf("}") + 1));

  return {
    site: {
      url: scraped.url,
      title: parsed.site?.title || scraped.title || scraped.url,
      description: parsed.site?.description || scraped.description || "",
    },
    competitors: (parsed.competitors ?? []).slice(0, 5),
    keywords: (parsed.keywords ?? []).slice(0, 10),
  };
}
