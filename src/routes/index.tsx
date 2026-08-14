import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Loader2, Globe, Target, KeyRound } from "lucide-react";

import { analyzeSite } from "@/lib/analyze.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Analyse SEO IA — Concurrents & mots-clés" },
      {
        name: "description",
        content:
          "Colle l'URL d'un site : l'IA le scrape et génère les 5 principaux concurrents et les meilleurs mots-clés SEO à cibler.",
      },
      { property: "og:title", content: "Analyse SEO IA — Concurrents & mots-clés" },
      {
        property: "og:description",
        content: "Scraping + IA : 5 concurrents et les meilleurs mots-clés en un clic.",
      },
    ],
  }),
  component: Index,
});

const difficultyLabel: Record<string, string> = {
  low: "Facile",
  medium: "Moyen",
  high: "Difficile",
};

function Index() {
  const [url, setUrl] = useState("");
  const analyze = useServerFn(analyzeSite);
  const mutation = useMutation({
    mutationFn: (value: string) => analyze({ data: { url: value } }),
  });

  const result = mutation.data;

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-hero">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <Badge variant="secondary" className="mb-6">
            Scraping interne + IA
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Trouve tes concurrents et tes mots-clés
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Colle l'adresse d'un site. On analyse son contenu et l'IA renvoie les 5 concurrents
            principaux ainsi que les meilleurs mots-clés à cibler.
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
              {mutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Search />
              )}
              Analyser
            </Button>
          </form>

          {mutation.isError && (
            <p className="mt-4 text-sm text-destructive">
              {(mutation.error as Error).message}
            </p>
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
              <p className="text-xs text-primary">{result.site.url}</p>
            </CardContent>
          </Card>

          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Target className="size-5 text-primary" /> 5 concurrents
          </h2>
          <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <KeyRound className="size-5 text-primary" /> Meilleurs mots-clés
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {result.keywords.map((k) => (
              <Card key={k.keyword}>
                <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
                  <CardTitle className="text-base">{k.keyword}</CardTitle>
                  <Badge variant={k.difficulty === "low" ? "default" : "secondary"}>
                    {difficultyLabel[k.difficulty] ?? k.difficulty}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Intention : {k.intent}
                  </p>
                  <p className="text-sm text-muted-foreground">{k.why}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
