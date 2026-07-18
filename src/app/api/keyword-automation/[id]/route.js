import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import KeywordAutomation from "@/shared/models/KeywordAutomation";

export async function PUT(req, { params }) {
  try {
    await connectDB();
    // 🚀 Unwrap the params promise before destructuring
    const { id } = await params; 
    const body = await req.json();
    
    // Ensure uniqueness except for self
    const exists = await KeywordAutomation.findOne({ 
      key: body.key.trim(), 
      _id: { $ne: id } 
    });

    if (exists) {
      return NextResponse.json({ success: false, error: "Keyword already exists." }, { status: 400 });
    }

    const updated = await KeywordAutomation.findByIdAndUpdate(id, body, { returnDocument: "after" });
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