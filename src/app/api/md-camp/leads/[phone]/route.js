import { categoryLeadService } from "@/features/chat/services/categoryLeadService";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const { phone } = resolvedParams;
    console.log(`[API GET /api/md-camp/leads/${phone}] Invoking categoryLeadService`);
    const data = await categoryLeadService.getCategoryLeadByPhone("MD Camp", phone);
    console.log(`[API GET /api/md-camp/leads/${phone}] Service returned:`, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API GET /api/md-camp/leads] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
