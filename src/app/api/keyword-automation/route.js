import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import KeywordAutomation from "@/shared/models/KeywordAutomation";

export async function GET(req) {
  try {
    await connectDB();
    const keywords = await KeywordAutomation.find()
      .populate("templateId", "name body category isActive")
      .sort({ createdAt: -1 });
    
    // On-the-fly migration for legacy rules
    let migratedAny = false;
    for (let rule of keywords) {
      if (!Array.isArray(rule.keywords) || rule.keywords.length === 0) {
        const fallbackKey = rule.key || rule.keyword;
        if (fallbackKey) {
          const cleanKey = fallbackKey.trim().toLowerCase();
          rule.keywords = [cleanKey];
          rule.key = cleanKey;
          await KeywordAutomation.findByIdAndUpdate(rule._id, {
            keywords: [cleanKey],
            key: cleanKey
          });
          migratedAny = true;
        }
      }
    }

    const cleanKeywords = migratedAny 
      ? await KeywordAutomation.find().populate("templateId", "name body category isActive").sort({ createdAt: -1 })
      : keywords;

    return NextResponse.json({ success: true, data: cleanKeywords });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();
    const { templateType = "whatsapp", templateId, templateSid, isActive } = body;

    let rawKeywords = body.keywords;
    if (!Array.isArray(rawKeywords)) {
      rawKeywords = [];
    }
    // Also extract legacy key/keyword fields
    const legacyKey = body.key || body.keyword;
    if (legacyKey && !rawKeywords.includes(legacyKey)) {
      rawKeywords.push(legacyKey);
    }

    // Normalize keywords: trim, lowercase, filter out empty or >100 characters, limit to 50
    const normalizedKeywords = Array.from(new Set(
      rawKeywords
        .map(k => typeof k === "string" ? k.trim().toLowerCase() : "")
        .filter(k => k.length > 0 && k.length <= 100)
    )).slice(0, 50);

    if (normalizedKeywords.length === 0) {
      return NextResponse.json({ success: false, error: "At least one valid keyword is required." }, { status: 400 });
    }

    if (templateType === "crm") {
      if (!templateId) {
        return NextResponse.json({ success: false, error: "CRM Template is required when template type is CRM." }, { status: 400 });
      }
    } else {
      if (!templateSid || !templateSid.trim()) {
        return NextResponse.json({ success: false, error: "WhatsApp Template SID is required." }, { status: 400 });
      }
    }

    // Uniqueness validation check: check if any keyword conflicts with existing rules (check both keywords array and legacy key/keyword)
    const conflict = await KeywordAutomation.findOne({
      $or: [
        { keywords: { $in: normalizedKeywords } },
        { key: { $in: normalizedKeywords } }
      ]
    });

    if (conflict) {
      return NextResponse.json({ success: false, error: "One or more keywords in the list already conflict with an existing automation rule." }, { status: 400 });
    }

    const rule = await KeywordAutomation.create({
      keywords: normalizedKeywords,
      key: normalizedKeywords[0], // backward compatibility
      templateType: templateType === "crm" ? "crm" : "whatsapp",
      templateId: templateType === "crm" ? templateId : null,
      templateSid: templateType === "whatsapp" ? (templateSid ? templateSid.trim() : "") : "",
      isActive: isActive !== false
    });

    const populatedRule = await KeywordAutomation.findById(rule._id).populate("templateId", "name body category isActive");

    return NextResponse.json({ success: true, data: populatedRule });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}