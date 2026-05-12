import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Template from "@/models/Template";

export const dynamic = "force-dynamic";

// GET All Templates
export async function GET() {
    try {
        await connectDB();
        const templates = await Template.find({}).sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, data: templates }, { status: 200 });
    } catch (error) {
        console.error("[GET /api/templates]", error);
        return NextResponse.json({ success: false, error: "Failed to fetch templates" }, { status: 500 });
    }
}

// POST Create Template
export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

        await connectDB();
        const body = await req.json();
        const { name, sid, category } = body;

        if (!name || !sid) {
            return NextResponse.json({ success: false, error: "Name and SID are required." }, { status: 400 });
        }

        // Validate Twilio SID format basic check
        if (!/^HX[a-fA-F0-9]{32}$/i.test(sid)) {
            return NextResponse.json({ success: false, error: "Invalid Twilio Content SID format." }, { status: 400 });
        }

        // Check for uniqueness
        const existing = await Template.findOne({ sid: sid.trim() });
        if (existing) {
            return NextResponse.json({ success: false, error: "A template with this SID already exists." }, { status: 409 });
        }

        const newTemplate = await Template.create({
            name: name.trim(),
            sid: sid.trim(),
            category: category || "marketing",
            createdBy: session.user?.id || "system"
        });

        return NextResponse.json({ success: true, data: newTemplate }, { status: 201 });
    } catch (error) {
        console.error("[POST /api/templates]", error);
        return NextResponse.json({ success: false, error: "Failed to create template" }, { status: 500 });
    }
}