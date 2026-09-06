import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth";
import { fetchPublicWebPage } from "@/lib/public-web-page";

export const runtime = "nodejs";
const schema = z.object({ url: z.string().trim().url().max(2_000) });

export async function POST(request: Request) {
  const { user } = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let url = "";
  try { url = schema.parse(await request.json()).url; } catch { return NextResponse.json({ error: "URL invalide." }, { status: 400 }); }
  try { return NextResponse.json(await fetchPublicWebPage(url)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Import du site impossible." }, { status: 502 }); }
}
