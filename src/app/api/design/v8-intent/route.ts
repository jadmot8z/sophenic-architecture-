import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth";
import { analyzeReferenceText, buildArchitectureIntent } from "@/design/design-intent";
import { parseArchitectureBrief } from "@/design/interior-brief";
import type { DesignProject } from "@/design/types";

export const runtime = "nodejs";

const schema = z.object({
  instruction: z.string().trim().max(6_000).default(""),
  project: z.record(z.string(), z.unknown()),
  references: z.array(z.object({ assetId: z.string().trim().max(200).optional(), name: z.string().trim().max(300), analysis: z.string().trim().max(20_000) })).max(12).default([])
});

export async function POST(request: Request) {
  const { user } = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await request.json()); } catch { return NextResponse.json({ error: "Requête Design Intent invalide." }, { status: 400 }); }
  const project = body.project as unknown as DesignProject;
  const references = body.references.map((item) => analyzeReferenceText(item));
  const brief = parseArchitectureBrief(body.instruction, project);
  const intent = buildArchitectureIntent(project, body.instruction, references);
  return NextResponse.json({ brief, intent, references });
}
