import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ruleId = Number(id);
  if (!Number.isInteger(ruleId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  const body = (await req.json()) as { active?: boolean };
  const rule = await prisma.alertRule.update({
    where: { id: ruleId },
    data: { ...(typeof body.active === "boolean" ? { active: body.active } : {}) },
  });
  return NextResponse.json({ rule });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ruleId = Number(id);
  if (!Number.isInteger(ruleId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  await prisma.alertRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ ok: true });
}
