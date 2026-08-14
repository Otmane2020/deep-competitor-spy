import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Loader2, Globe, Target, KeyRound, FileText, LayoutList } from "lucide-react";

import { analyzeSite } from "@/lib/analyze.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Analyse SEO IA — Concurrents, mots-clés & briefs" },
      {
        name: "description",
        content:
          "Colle une URL : scraping des landing pages, titles et meta descriptions, concurrents et mots-clés validés par DataForSEO, briefs d'articles prêts à générer.",
      },
      { property: "og:title", content: "Analyse SEO IA — Concurrents, mots-clés & briefs" },
      {
        property: "og:description",
        content: "Scraping + DeepSeek + DataForSEO : concurrents, mots-clés et briefs d'articles.",
      },
      { property: "og:url", content: "/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

const difficultyLabel: Record<string, string> = {
  low: "Facile",
  medium: "Moyen",
  high: "Difficile",
};

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-12">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <Icon className="size-5 text-primary" /> {title}
      </h2>
      {children}
    </div>
  );
}

function Index() {
  const [url, setUrl] = useState("");
  const analyze = useServerFn(analyzeSite);
  const mutation = useMutation({
    mutationFn: (value: string) => analyze({ data: { url: value } }),
  });

  const result = mutation.data;

  return (
    <main className="min-h-screen bg-background">
      <section className="bg-hero">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <Badge variant="secondary" className="mb-6">
            Scraping + DeepSeek + DataForSEO
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Concurrents, mots-clés et briefs d'articles
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            On lit les landing pages, les titles et les meta descriptions, on extrait les mots-clés,
            on les confronte aux volumes réels DataForSEO et on prépare des briefs prêts pour un
            moteur de génération d'articles.
          </p>

          <form
            className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) mutation.mutate(url.trim());
            }}
          >
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemple.com"
              className="h-12"
              aria-label="URL du site à analyser"
            />
            <Button type="submit" size="lg" disabled={mutation.isPending} className="h-12">
              {mutation.isPending ? <Loader2 className="animate-spin" /> : <Search />}
              Analyser
            </Button>
          </form>

          {mutation.isPending && (
            <p className="mt-4 text-sm text-muted-foreground">
              Crawl des pages, analyse IA et enrichissement DataForSEO en cours…
            </p>
          )}
          {mutation.isError && (
            <p className="mt-4 text-sm text-destructive">{(mutation.error as Error).message}</p>
          )}
        </div>
      </section>

      {result && (
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <Card className="mb-10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="size-4 text-primary" />
                {result.site.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{result.site.description}</p>
              <p className="text-xs text-primary">
                {result.site.domain} · langue {result.site.lang}
              </p>
              {result.notes.map((n) => (
                <p key={n} className="text-xs text-accent">
                  {n}
                </p>
              ))}
            </CardContent>
          </Card>

          <Section icon={LayoutList} title={`Landing pages analysées (${result.pages.length})`}>
            <div className="space-y-4">
              {result.pages.map((p) => (
                <Card key={p.url}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{p.title || "(sans title)"}</CardTitle>
                    <p className="break-all text-xs text-primary">{p.url}</p>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <span className="text-foreground">Meta description :</span>{" "}
                      {p.metaDescription || "manquante"}
                    </p>
                    {p.h1 && (
                      <p>
                        <span className="text-foreground">H1 :</span> {p.h1}
                      </p>
                    )}
                    <p className="text-xs">
                      {p.wordCount} mots · {p.headings.length} sous-titres
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {p.topTerms.slice(0, 10).map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>

          <Section icon={Target} title="Concurrents">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.competitors.map((c) => (
                <Card key={c.domain + c.name}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <p className="text-xs text-primary">{c.domain}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{c.why}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {result.dfsCompetitors.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-sm text-muted-foreground">
                  Confrontés aux concurrents organiques réels (DataForSEO) :
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.dfsCompetitors.map((c) => (
                    <Card key={c.domain}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{c.domain}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        <p>{c.organicKeywords ?? "—"} mots-clés organiques</p>
                        <p>Trafic estimé : {c.organicTraffic ?? "—"}</p>
                        <p>Intersections : {c.intersections ?? "—"}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section icon={KeyRound} title="Mots-clés (volumes DataForSEO)">
            <div className="grid gap-4 sm:grid-cols-2">
              {result.keywords.map((k) => (
                <Card key={k.keyword}>
                  <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
                    <CardTitle className="text-base">{k.keyword}</CardTitle>
                    <Badge variant={k.difficulty === "low" ? "default" : "secondary"}>
                      {difficultyLabel[k.difficulty] ?? k.difficulty}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p className="text-foreground">
                      {k.volume != null ? `${k.volume} rech./mois` : "volume n/d"}
                      {k.cpc != null && ` · CPC ${k.cpc.toFixed(2)}`}
                      {k.competition != null && ` · concurrence ${k.competition}`}
                    </p>
                    <p className="text-xs uppercase tracking-wide">Intention : {k.intent}</p>
                    <p>{k.why}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {result.rankedKeywords.length > 0 && (
              <Card className="mt-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Mots-clés déjà positionnés</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {result.rankedKeywords.map((k) => (
                    <Badge key={k.keyword} variant="secondary">
                      {k.keyword} {k.volume != null && `· ${k.volume}`}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </Section>

          <Section icon={FileText} title="Briefs d'articles">
            <div className="space-y-4">
              {result.articleBriefs.map((b) => (
                <Card key={b.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{b.title}</CardTitle>
                    <p className="text-xs text-primary">Mot-clé cible : {b.targetKeyword}</p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>{b.angle}</p>
                    <ol className="list-decimal space-y-1 pl-5">
                      {b.outline?.map((o) => <li key={o}>{o}</li>)}
                    </ol>
                    {b.questions?.length > 0 && (
                      <div>
                        <p className="text-foreground">Questions à traiter</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {b.questions.map((q) => (
                            <li key={q}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {b.entities?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {b.entities.map((e) => (
                          <Badge key={e} variant="secondary">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => {
                const blob = new Blob([JSON.stringify(result, null, 2)], {
                  type: "application/json",
                });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${result.site.domain}-seo.json`;
                a.click();
              }}
            >
              Exporter en JSON pour le moteur d'articles
            </Button>
          </Section>
        </section>
      )}
    </main>
  );
}
