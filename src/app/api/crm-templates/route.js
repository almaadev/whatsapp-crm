import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import CRMTemplate from "@/shared/models/CRMTemplate";
import { extractVariablesFromText, sanitizeWhatsAppText } from "@/shared/utils/templateResolver";
import { CRM_TEMPLATE_VARIABLES } from "@/shared/utils/templateVariables";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "";

    const filter = { isArchived: { $ne: true } };

    if (category && category !== "All") {
      filter.category = category;
    }

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "inactive") {
      filter.isActive = false;
    }

    if (search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { body: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ];
    }

    const templates = await CRMTemplate.find(filter)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    console.error("[GET /api/crm-templates] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const { name, body: rawBody, category = "General", isActive = true } = body || {};

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Template name is required" }, { status: 400 });
    }

    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ success: false, error: "Template message body is required" }, { status: 400 });
    }

    const sanitizedBody = sanitizeWhatsAppText(rawBody);
    const variableKeys = extractVariablesFromText(sanitizedBody);

    const variables = variableKeys.map((key) => {
      const meta = CRM_TEMPLATE_VARIABLES[key] || {};
      return {
        key,
        label: meta.label || key,
        source: meta.source || `custom.${key}`,
        required: meta.required || false,
        fallback: meta.fallback || "",
      };
    });

    const newTemplate = await CRMTemplate.create({
      name: name.trim(),
      body: sanitizedBody,
      category: category.trim() || "General",
      variables,
      version: 1,
      isActive: Boolean(isActive),
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "CRM Template created successfully",
      data: newTemplate,
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/crm-templates] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to create template" }, { status: 500 });
  }
}
