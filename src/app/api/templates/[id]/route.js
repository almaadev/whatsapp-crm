import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user.role !== 'superAdmin' && session.user.department !== 'admin')) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params; // Twilio Content SID

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

        const twilioRes = await fetch(`https://content.twilio.com/v1/Content/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader }
        });

        if (!twilioRes.ok && twilioRes.status !== 404) {
             return NextResponse.json({ success: false, error: "Failed to delete from Twilio." }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: "Template permanently deleted from Twilio" }, { status: 200 });
    } catch (error) {
        console.error("[DELETE /api/templates/:id]", error);
        return NextResponse.json({ success: false, error: "Failed to delete template" }, { status: 500 });
    }
}