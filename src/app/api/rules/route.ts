import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_FILTER } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rules = await prisma.alertRule.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    rules: rules.map((r) => ({ ...r, filter: safeParse(r.filterJson) })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name?: string;
    filter?: Record<string, unknown>;
    cooldownMinutes?: number;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  }
  // Konzept 4.4: Screening-Filter erfüllt UND Ampel grün → Alert.
  const filter = { ...DEFAULT_FILTER, requireGreen: true, ...(body.filter ?? {}) };
  const rule = await prisma.alertRule.create({
    data: {
      name: body.name.trim(),
      filterJson: JSON.stringify(filter),
      cooldownMinutes: clampCooldown(body.cooldownMinutes),
    },
  });
  return NextResponse.json({ rule: { ...rule, filter } });
}

function clampCooldown(v: number | undefined): number {
  if (!Number.isFinite(v)) return 360;
  return Math.max(15, Math.min(10_080, Math.round(v!)));
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
