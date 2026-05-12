import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Template from "@/models/Template";

export const dynamic = "force-dynamic";

// --- CHECK APPROVAL STATUS (GET) ---
export async function GET(req) {
    try {
        await connectDB();
        const session = await getServerSession(authOptions);
        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const isAdmin = session?.user?.department === 'admin';
        
        if (!session || (!isSuperAdmin && !isAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const sid = searchParams.get('sid');
        
        if (!sid) return NextResponse.json({ error: "SID required" }, { status: 400 });

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

        const twilioRes = await fetch(`https://content.twilio.com/v1/Content/${sid}`, {
            method: 'GET',
            headers: { 'Authorization': authHeader }
        });
        
        const twilioData = await twilioRes.json();

        if (twilioRes.ok) {
            const waApproval = twilioData.approval_requests?.whatsapp;
            
            if (waApproval && waApproval.status) {
                await Template.findOneAndUpdate({ sid }, { approvalStatus: waApproval.status });
                return NextResponse.json({ success: true, status: waApproval.status, details: twilioData });
            } else {
                await Template.findOneAndUpdate({ sid }, { approvalStatus: "unsubmitted" });
                return NextResponse.json({ success: true, status: "unsubmitted", message: "Template found but not yet submitted for approval." });
            }
        } 
        else if (twilioRes.status === 404 || (twilioData.code && twilioData.code === 20404)) {
            return NextResponse.json({ success: false, error: "Template not found in Twilio API" }, { status: 404 });
        } 
        else {
            return NextResponse.json({ success: false, error: twilioData.message || "Failed to fetch status" }, { status: 400 });
        }

    } catch (error) {
        console.error("Approval GET Error:", error);
        return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
    }
}


// --- MANUAL SUBMIT TO WHATSAPP (POST) ---
export async function POST(req) {
    try {
        await connectDB();
        const session = await getServerSession(authOptions);
        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const isAdmin = session?.user?.department === 'admin';
        
        if (!session || (!isSuperAdmin && !isAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { sid, name, category } = await req.json();
        
        const safeName = (name || `tpl_${Date.now()}`).toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 512);
        const safeCategory = category || "UTILITY";

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

        // Send Approval Request to Twilio
        const twilioRes = await fetch(`https://content.twilio.com/v1/Content/${sid}/ApprovalRequests/whatsapp`, {
            method: 'POST',
            headers: { 
                'Authorization': authHeader, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                name: safeName,
                category: safeCategory
            })
        });

        const twilioData = await twilioRes.json();

        if (twilioRes.ok) {
            await Template.findOneAndUpdate({ sid }, { approvalStatus: "pending" });
            return NextResponse.json({ success: true, status: "pending" });
        } else {
            console.error("Twilio Approval Submit Error:", twilioData);

            // 👇 FIX: Catch "Already submitted" error gracefully and auto-sync the real status
            if (twilioData.message && twilioData.message.includes("already been submitted")) {
                
                // Fetch the actual current status from Twilio
                const checkRes = await fetch(`https://content.twilio.com/v1/Content/${sid}`, {
                    method: 'GET',
                    headers: { 'Authorization': authHeader }
                });
                const checkData = await checkRes.json();
                const actualStatus = checkData.approval_requests?.whatsapp?.status || "pending";

                // Update our DB to match Twilio perfectly
                await Template.findOneAndUpdate({ sid }, { approvalStatus: actualStatus });
                
                return NextResponse.json({ 
                    success: true, 
                    status: actualStatus, 
                    message: "Template was already submitted. We synced the latest status for you!" 
                });
            }

            // For all other actual errors
            await Template.findOneAndUpdate({ sid }, { approvalStatus: "failed_submission" });
            return NextResponse.json({ success: false, error: twilioData.message || "Submission failed" }, { status: 400 });
        }
        
    } catch (error) {
        console.error("Approval POST Error:", error);
        return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
    }
}