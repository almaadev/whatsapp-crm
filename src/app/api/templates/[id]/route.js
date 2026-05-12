import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Template from "@/models/Template";

export const dynamic = "force-dynamic";

// PUT Update Template
export async function PUT(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        // Unwrap params safely for Next 15+ compatibility
        const resolvedParams = await params;
        const id = resolvedParams.id;
        
        const body = await req.json();
        const { name, sid, category } = body;

        if (!name || !sid) {
            return NextResponse.json({ success: false, error: "Name and SID are required." }, { status: 400 });
        }

        // Check if updating to a SID that belongs to another template
        const existing = await Template.findOne({ sid: sid.trim(), _id: { $ne: id } });
        if (existing) {
            return NextResponse.json({ success: false, error: "Another template already uses this SID." }, { status: 409 });
        }

        const updatedTemplate = await Template.findByIdAndUpdate(
            id,
            { name: name.trim(), sid: sid.trim(), category },
            { new: true }
        );

        if (!updatedTemplate) {
            return NextResponse.json({ success: false, error: "Template not found." }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: updatedTemplate }, { status: 200 });
    } catch (error) {
        console.error("[PUT /api/templates/:id]", error);
        return NextResponse.json({ success: false, error: "Failed to update template" }, { status: 500 });
    }
}

// DELETE Remove Template
export async function DELETE(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

        await connectDB();
        const resolvedParams = await params;
        const id = resolvedParams.id;

        const deletedTemplate = await Template.findByIdAndDelete(id);
        if (!deletedTemplate) {
            return NextResponse.json({ success: false, error: "Template not found." }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Template deleted successfully" }, { status: 200 });
    } catch (error) {
        console.error("[DELETE /api/templates/:id]", error);
        return NextResponse.json({ success: false, error: "Failed to delete template" }, { status: 500 });
    }
}