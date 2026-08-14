import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AnalysisResult } from "./analyze.server";

export const analyzeSite = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ url: z.string().min(3).max(300) }).parse(data))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const apiKey = process.env["DEEPSEEK_API_KEY"];
    if (!apiKey) throw new Error("Clé DeepSeek manquante.");
    const { scrapeSite, analyzeWithAI } = await import("./analyze.server");
    const scraped = await scrapeSite(data.url);
    return analyzeWithAI(scraped, apiKey);
  });
