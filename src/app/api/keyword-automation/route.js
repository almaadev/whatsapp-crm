import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import KeywordAutomation from "@/models/KeywordAutomation";

export async function GET(req) {
  try {
    await connectDB();
    const keywords = await KeywordAutomation.find().sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: keywords });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();
    const { key, templateSid, isActive } = body;

    if (!key || !templateSid) {
      return NextResponse.json({ success: false, error: "Keyword and Template SID are required." }, { status: 400 });
    }

    const exists = await KeywordAutomation.findOne({ key: key.toLowerCase().trim() });
    if (exists) {
      return NextResponse.json({ success: false, error: "This keyword already exists." }, { status: 400 });
    }

    const keyword = await KeywordAutomation.create({ key, templateSid, isActive });
    return NextResponse.json({ success: true, data: keyword });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}