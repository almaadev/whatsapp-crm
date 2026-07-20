import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import KeywordAutomation from "@/shared/models/KeywordAutomation";

export async function PUT(req, { params }) {
  try {
    await connectDB();
    // 🚀 Unwrap the params promise before destructuring
    const { id } = await params; 
    const body = await req.json();
    const { templateSid, isActive } = body;
    
    let rawKeywords = body.keywords;
    if (!Array.isArray(rawKeywords)) {
      rawKeywords = [];
    }
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

    if (!templateSid) {
      return NextResponse.json({ success: false, error: "Template SID is required." }, { status: 400 });
    }

    // Ensure uniqueness except for self
    const conflict = await KeywordAutomation.findOne({ 
      _id: { $ne: id },
      $or: [
        { keywords: { $in: normalizedKeywords } },
        { key: { $in: normalizedKeywords } }
      ]
    });

    if (conflict) {
      return NextResponse.json({ success: false, error: "One or more keywords in the list already conflict with an existing automation rule." }, { status: 400 });
    }

    const updateBody = {
      keywords: normalizedKeywords,
      key: normalizedKeywords[0], // backward compatibility
      templateSid: templateSid.trim(),
      isActive: isActive !== false
    };

    const updated = await KeywordAutomation.findByIdAndUpdate(id, updateBody, { returnDocument: "after" });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    // 🚀 Unwrap the params promise
    const { id } = await params;
    await KeywordAutomation.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await connectDB();
    // 🚀 Unwrap the params promise
    const { id } = await params;
    const { isActive } = await req.json();
    const updated = await KeywordAutomation.findByIdAndUpdate(id, { isActive }, { returnDocument: "after" });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}