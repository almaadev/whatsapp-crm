import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import CRMTemplate from "@/shared/models/CRMTemplate";
import KeywordAutomation from "@/shared/models/KeywordAutomation";
import { extractVariablesFromText, sanitizeWhatsAppText } from "@/shared/utils/templateResolver";
import { CRM_TEMPLATE_VARIABLES } from "@/shared/utils/templateVariables";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const template = await CRMTemplate.findById(id)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .lean();

    if (!template || template.isArchived) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error("[GET /api/crm-templates/:id] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch template" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const template = await CRMTemplate.findById(id);
    if (!template || template.isArchived) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, body: rawBody, category, isActive } = body || {};

    let contentChanged = false;

    if (name !== undefined && name.trim()) {
      template.name = name.trim();
    }

    if (category !== undefined) {
      template.category = category.trim() || "General";
    }

    if (isActive !== undefined) {
      template.isActive = Boolean(isActive);
    }

    if (rawBody !== undefined && rawBody.trim()) {
      const sanitized = sanitizeWhatsAppText(rawBody);
      if (sanitized !== template.body) {
        template.body = sanitized;
        contentChanged = true;

        const variableKeys = extractVariablesFromText(sanitized);
        template.variables = variableKeys.map((key) => {
          const meta = CRM_TEMPLATE_VARIABLES[key] || {};
          return {
            key,
            label: meta.label || key,
            source: meta.source || `custom.${key}`,
            required: meta.required || false,
            fallback: meta.fallback || "",
          };
        });
      }
    }

    if (contentChanged) {
      template.version = (template.version || 1) + 1;
    }

    template.updatedBy = session.user.id;
    await template.save();

    return NextResponse.json({
      success: true,
      message: "CRM Template updated successfully",
      data: template,
    });
  } catch (error) {
    console.error("[PATCH /api/crm-templates/:id] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const template = await CRMTemplate.findById(id);
    if (!template || template.isArchived) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    // Guard: Check if template is referenced in any active KeywordAutomation
    const linkedAutomations = await KeywordAutomation.find({
      templateId: id,
      isActive: true,
    }).lean();

    if (linkedAutomations.length > 0) {
      const keywordsList = linkedAutomations
        .flatMap((a) => a.keywords || [a.key])
        .filter(Boolean)
        .slice(0, 3)
        .join(", ");

      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete template: It is actively referenced by keyword automation rule(s) matching [${keywordsList}]. Please reassign or deactivate the automation rule first, or deactivate this template instead.`,
          isReferenced: true,
        },
        { status: 400 }
      );
    }

    // Soft delete / archive to preserve historical message references
    template.isArchived = true;
    template.isActive = false;
    template.updatedBy = session.user.id;
    await template.save();

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/crm-templates/:id] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to delete template" }, { status: 500 });
  }
}
