import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Template from "@/models/Template";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        await connectDB();
        const session = await getServerSession(authOptions);

        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const isAdmin = session?.user?.department === 'admin';

        if (!session || (!isSuperAdmin && !isAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const templates = await Template.find().sort({ createdAt: -1 });
        return NextResponse.json({ success: true, templates });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await connectDB();
        const session = await getServerSession(authOptions);
        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const isAdmin = session?.user?.department === 'admin';

        if (!session || (!isSuperAdmin && !isAdmin)) {
            return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
        }

        const formData = await req.formData();
        const friendly_name = formData.get("friendly_name");
        const body = formData.get("body");
        const category = formData.get("category") || "UTILITY";
        const language = formData.get("language") || "en";
        const templateType = formData.get("templateType") || "TEXT"; // TEXT, WHATSAPP_CARD, CALL_TO_ACTION
        const headerType = formData.get("headerType") || "NONE"; 
        const headerText = formData.get("headerText") || "";
        const footerText = formData.get("footerText") || "";
        
        const variables = JSON.parse(formData.get("variables") || "{}");
        const buttons = JSON.parse(formData.get("buttons") || "[]");
        const imageFile = formData.get("image");

        if (!friendly_name || !body) return NextResponse.json({ error: "Friendly name and body are required." }, { status: 400 });

        let mediaUrl = "";

        // 1. Handle Server-Side Image Upload safely (Enforcing HTTP/HTTPS)
        if (imageFile && imageFile !== 'null') {
            const buffer = Buffer.from(await imageFile.arrayBuffer());
            const fileName = `${Date.now()}_${imageFile.name.replace(/\s+/g, '_')}`;
            const uploadDir = path.join(process.cwd(), "public", "uploads", "templates");
            
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            fs.writeFileSync(path.join(uploadDir, fileName), buffer);
            
            let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
            if (!baseUrl) {
                // Determine Host and Protocol dynamically (especially for Ngrok)
                const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
                const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
                baseUrl = `${protocol}://${host}`;
            }
            baseUrl = baseUrl.replace(/\/+$/, "");
            mediaUrl = `${baseUrl}/uploads/templates/${fileName}`;

            // Absolute Failsafe: Twilio strictly requires http/https
            if (!mediaUrl.startsWith("http")) {
                mediaUrl = "https://" + mediaUrl;
            }
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

        // 2. Build the Dynamic Twilio Payload
        let types = {};
        
        // Format Actions
        const formattedActions = buttons.length > 0 ? buttons.map(b => {
            const action = { type: b.type, title: b.title };
            if (b.type === 'URL') action.url = b.value;
            if (b.type === 'PHONE_NUMBER') action.phone = b.value;
            if (b.type === 'QUICK_REPLY') action.id = b.title.toLowerCase().replace(/[^a-z0-9]/g, '_') || `qr_${Date.now()}`;
            return action;
        }) : undefined;

        // 👇 FIX: Use Native WhatsApp Card Format (whatsapp/card)
        if (templateType === 'WHATSAPP_CARD') {
            types["whatsapp/card"] = { body: body };
            if (footerText) types["whatsapp/card"].footer = footerText;
            
            // WhatsApp Cards can ONLY have either Media OR Header Text, not both.
            if (headerType === 'MEDIA' && mediaUrl) {
                types["whatsapp/card"].media = [mediaUrl];
            } else if (headerType === 'TEXT' && headerText) {
                types["whatsapp/card"].header_text = headerText;
            }

            if (formattedActions) types["whatsapp/card"].actions = formattedActions;

        // Call to Action / Quick Reply Format
        } else if (templateType === 'CALL_TO_ACTION' || (formattedActions && formattedActions.length > 0)) {
            let finalBody = body;
            if (headerType === 'TEXT' && headerText) finalBody = `*${headerText}*\n\n${finalBody}`;
            if (footerText) finalBody = `${finalBody}\n\n_${footerText}_`;

            if (buttons.some(b => b.type === 'QUICK_REPLY')) {
                types["twilio/quick-reply"] = { body: finalBody, actions: formattedActions };
            } else {
                types["twilio/call-to-action"] = { body: finalBody, actions: formattedActions };
            }

        // Basic Text Format
        } else {
            let finalBody = body;
            if (headerType === 'TEXT' && headerText) finalBody = `*${headerText}*\n\n${finalBody}`;
            if (footerText) finalBody = `${finalBody}\n\n_${footerText}_`;
            types["twilio/text"] = { body: finalBody };
        }

        const payload = { friendly_name, language, types };
        if (Object.keys(variables).length > 0) payload.variables = variables;

        // 3. Call Twilio API to Create Content Template
        const createRes = await fetch(`https://content.twilio.com/v1/Content`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await createRes.json();
        if (!createRes.ok) {
            console.error("Twilio Create Error:", data);
            return NextResponse.json({ error: data.message || "Twilio API Error" }, { status: createRes.status });
        }

        // 4. Submit for WhatsApp Approval
        const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${data.sid}/ApprovalRequests/whatsapp`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: friendly_name.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 512),
                category: category 
            })
        });

        const approvalData = await approvalRes.json();
        const approvalStatus = approvalRes.ok ? "pending" : "failed_submission";
        if(!approvalRes.ok) console.error("Twilio Approval Submit Error:", approvalData);

        // 5. Save to Database
        const newTemplate = await Template.create({
            name: friendly_name,
            sid: data.sid,
            templateType: templateType,
            language: language,
            body: body,
            mediaUrl: mediaUrl,
            buttons: buttons,
            category: category,
            approvalStatus: approvalStatus,
            createdBy: session.user.name || "admin"
        });

        return NextResponse.json({
            success: true,
            contentSid: data.sid,
            friendlyName: data.friendly_name,
            approvalStatus: approvalStatus,
            mediaUrl: mediaUrl,
            template: newTemplate
        });

    } catch (error) {
        console.error("Create Template Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}