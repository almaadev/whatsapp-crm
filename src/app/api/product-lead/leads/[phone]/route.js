import { categoryLeadService } from "@/features/chat/services/categoryLeadService";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const resolvedParams = await params;
    const { phone } = resolvedParams;
    console.log(`[API GET /api/product-lead/leads/${phone}] Invoking categoryLeadService`);
    const data = await categoryLeadService.getCategoryLeadByPhone("Product Lead", phone, session);
    console.log(`[API GET /api/product-lead/leads/${phone}] Service returned:`, data);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API GET /api/product-lead/leads] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
