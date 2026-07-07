import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// ==========================================
// GET: Fetch ALL templates & Statuses from Twilio (No DB)
// ==========================================
export async function GET(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user.role !== 'superAdmin' && session.user.department !== 'admin')) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

        let allContents = [];
        let nextPageUrl = `https://content.twilio.com/v1/Content`;

        // 1. Fetch ALL pages of templates from Twilio Content API
        while (nextPageUrl) {
            const twilioRes = await fetch(nextPageUrl, {
                method: 'GET',
                headers: { 'Authorization': authHeader }
            });

            if (twilioRes.ok) {
                const twilioData = await twilioRes.json();
                allContents = allContents.concat(twilioData.contents || []);
                nextPageUrl = twilioData.meta?.next_page_url || null; 
            } else {
                console.error("Failed to fetch from Twilio API");
                break;
            }
        }

        // 2. PARALLEL FETCH: Get Approval Statuses for ALL templates
        const formattedTemplates = await Promise.all(
            allContents.map(async (content) => {
                let approvalData = null;

                // Hit the specific ApprovalRequests endpoint if the link exists
                if (content.links && content.links.approval_fetch) {
                    try {
                        const approvalRes = await fetch(content.links.approval_fetch, {
                            method: 'GET',
                            headers: { 'Authorization': authHeader }
                        });
                        if (approvalRes.ok) {
                            approvalData = await approvalRes.json();
                        }
                    } catch (e) {
                        console.error(`Failed to fetch approval for ${content.sid}`);
                    }
                }

                // Extract WhatsApp specific details
                let waData = {
                    status: "draft",
                    category: "UTILITY",
                    rejection_reason: "",
                    name: content.friendly_name
                };

                if (approvalData && approvalData.whatsapp) {
                    waData = {
                        status: approvalData.whatsapp.status ,
                        category: approvalData.whatsapp.category || "UTILITY",
                        rejection_reason: approvalData.whatsapp.rejection_reason || "",
                        content_type: approvalData.whatsapp.content_type || "",
                        type: approvalData.whatsapp.type || "whatsapp",
                        name: approvalData.whatsapp.name || content.friendly_name
                    };
                }

                // Determine Format
                const types = content.types || {};
                let tType = "TEXT";
                if (types["whatsapp/card"]) tType = "WHATSAPP_CARD";
                else if (types["twilio/call-to-action"] || types["twilio/quick-reply"]) tType = "CALL_TO_ACTION";

                let bodyText = "Content synced from Twilio";
                const typeKey = Object.keys(types)[0];
                if (typeKey && types[typeKey] && types[typeKey].body) {
                    bodyText = types[typeKey].body;
                }

                return {
                    _id: content.sid, // Use SID as the React Key
                    sid: content.sid,
                    name: content.friendly_name || "Unnamed Template",
                    language: content.language || "en",
                    templateType: tType,
                    body: bodyText,
                    dateCreated: content.date_created,
                    dateUpdated: content.date_updated,
                    whatsapp: waData
                };
            })
        );

        return NextResponse.json({ success: true, templates: formattedTemplates });
    } catch (error) {
        console.error("GET Twilio Templates Error:", error);
        return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
    }
}

// ==========================================
// POST: Create a new template in Twilio (No DB)
// ==========================================
export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user.role !== 'superAdmin' && session.user.department !== 'admin')) {
            return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
        }

        const formData = await req.formData();
        const friendly_name = formData.get("friendly_name");
        const body = formData.get("body");
        const category = formData.get("category") || "UTILITY";
        const language = formData.get("language") || "en";
        const templateType = formData.get("templateType") || "TEXT"; 
        const headerType = formData.get("headerType") || "NONE"; 
        const headerText = formData.get("headerText") || "";
        const footerText = formData.get("footerText") || "";
        
        const variables = JSON.parse(formData.get("variables") || "{}");
        const buttons = JSON.parse(formData.get("buttons") || "[]");
        const imageFile = formData.get("image");

        if (!friendly_name || !body) return NextResponse.json({ error: "Friendly name and body are required." }, { status: 400 });

        let mediaUrl = "";

        if (imageFile && imageFile !== 'null') {
            const buffer = Buffer.from(await imageFile.arrayBuffer());
            const fileName = `${Date.now()}_${imageFile.name.replace(/\s+/g, '_')}`;
            const uploadDir = path.join(process.cwd(), "public", "uploads", "templates");
            
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            fs.writeFileSync(path.join(uploadDir, fileName), buffer);
            
            let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
            if (!baseUrl) {
                const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
                const protocol = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
                baseUrl = `${protocol}://${host}`;
            }
            baseUrl = baseUrl.replace(/\/+$/, "");
            mediaUrl = `${baseUrl}/uploads/templates/${fileName}`;
            if (!mediaUrl.startsWith("http")) mediaUrl = "https://" + mediaUrl;
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

        let types = {};
        
        const formattedActions = buttons.length > 0 ? buttons.map(b => {
            const action = { type: b.type, title: b.title };
            if (b.type === 'URL') action.url = b.value;
            if (b.type === 'PHONE_NUMBER') action.phone = b.value;
            if (b.type === 'QUICK_REPLY') action.id = b.title.toLowerCase().replace(/[^a-z0-9]/g, '_') || `qr_${Date.now()}`;
            return action;
        }) : undefined;

        if (templateType === 'WHATSAPP_CARD') {
            types["whatsapp/card"] = { body: body };
            if (footerText) types["whatsapp/card"].footer = footerText;
            if (headerType === 'MEDIA' && mediaUrl) types["whatsapp/card"].media = [mediaUrl];
            else if (headerType === 'TEXT' && headerText) types["whatsapp/card"].header_text = headerText;
            if (formattedActions) types["whatsapp/card"].actions = formattedActions;

        } else if (templateType === 'CALL_TO_ACTION' || (formattedActions && formattedActions.length > 0)) {
            let finalBody = body;
            if (headerType === 'TEXT' && headerText) finalBody = `*${headerText}*\n\n${finalBody}`;
            if (footerText) finalBody = `${finalBody}\n\n_${footerText}_`;

            if (buttons.some(b => b.type === 'QUICK_REPLY')) types["twilio/quick-reply"] = { body: finalBody, actions: formattedActions };
            else types["twilio/call-to-action"] = { body: finalBody, actions: formattedActions };

        } else {
            let finalBody = body;
            if (headerType === 'TEXT' && headerText) finalBody = `*${headerText}*\n\n${finalBody}`;
            if (footerText) finalBody = `${finalBody}\n\n_${footerText}_`;
            types["twilio/text"] = { body: finalBody };
        }

        const payload = { friendly_name, language, types };
        if (Object.keys(variables).length > 0) payload.variables = variables;

        // 1. Create in Twilio Content API
        const createRes = await fetch(`https://content.twilio.com/v1/Content`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await createRes.json();
        if (!createRes.ok) return NextResponse.json({ error: data.message || "Twilio API Error" }, { status: createRes.status });

        // 2. Submit for WhatsApp Approval
        const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${data.sid}/ApprovalRequests/whatsapp`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: friendly_name.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 512),
                category: category 
            })
        });

        const approvalStatus = approvalRes.ok ? "pending" : "failed_submission";

        return NextResponse.json({ success: true, contentSid: data.sid, approvalStatus });

    } catch (error) {
        console.error("Create Template Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
