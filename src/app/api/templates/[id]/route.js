import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Template from "@/models/Template";

export const dynamic = "force-dynamic";

// --- PUT: Update Template ---
export async function PUT(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

        await connectDB();
        const { id } = await params;
        const body = await req.json();
        const { name, sid, category } = body;

        if (!name || !sid) {
            return NextResponse.json({ success: false, error: "Name and SID are required." }, { status: 400 });
        }

        const existing = await Template.findOne({ sid: sid.trim(), _id: { $ne: id } });
        if (existing) {
            return NextResponse.json({ success: false, error: "Another template already uses this SID." }, { status: 409 });
        }

        const updatedTemplate = await Template.findByIdAndUpdate(
            id,
            { name: name.trim(), sid: sid.trim(), category },
            { new: true }
        );

        if (!updatedTemplate) return NextResponse.json({ success: false, error: "Template not found." }, { status: 404 });

        return NextResponse.json({ success: true, data: updatedTemplate }, { status: 200 });
    } catch (error) {
        console.error("[PUT /api/templates/:id]", error);
        return NextResponse.json({ success: false, error: "Failed to update template" }, { status: 500 });
    }
}

// --- DELETE: Remove Template from CRM and Twilio ---
export async function DELETE(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user.role !== 'superAdmin' && session.user.department !== 'admin')) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        await connectDB();
        const { id } = await params;

        // Query by SID if the ID starts with 'HX' or 'DRAFT', otherwise query by MongoDB _id
        const query = id.startsWith('HX') || id.startsWith('DRAFT') ? { sid: id } : { _id: id };
        
        // First, find the template so we can get its SID for Twilio deletion
        const template = await Template.findOne(query);

        if (!template) {
            return NextResponse.json({ success: false, error: "Template not found." }, { status: 404 });
        }

        const contentSid = template.sid;

        // Optionally delete from Twilio if it's an approved template (HX)
        if (contentSid && contentSid.startsWith('HX')) {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

            const twilioRes = await fetch(`https://content.twilio.com/v1/Content/${contentSid}`, {
                method: 'DELETE',
                headers: { 'Authorization': authHeader }
            });

            // Only throw error if Twilio fails and it wasn't simply 'not found' on Twilio's end
            if (!twilioRes.ok && twilioRes.status !== 404) {
                 return NextResponse.json({ success: false, error: "Failed to delete from Twilio." }, { status: 400 });
            }
        }

        // Finally, delete from MongoDB using the internal _id we just found
        await Template.findByIdAndDelete(template._id);
        
        return NextResponse.json({ success: true, message: "Template permanently deleted" }, { status: 200 });
    } catch (error) {
        console.error("[DELETE /api/templates/:id]", error);
        return NextResponse.json({ success: false, error: "Failed to delete template" }, { status: 500 });
    }
}