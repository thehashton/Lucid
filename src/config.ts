import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const lucidConfigSchema = z.object({
  routes: z.record(
    z.string(),
    z.record(z.string(), z.array(z.string())),
  ),
});

export type LucidConfig = z.infer<typeof lucidConfigSchema>;

export async function loadLucidConfig(
  cwd: string = process.cwd(),
): Promise<LucidConfig | null> {
  const configPath = path.join(cwd, "lucid.config.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return lucidConfigSchema.parse(JSON.parse(raw));
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

