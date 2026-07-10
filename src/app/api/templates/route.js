import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

        let allContents = [];
        let nextPageUrl = `https://content.twilio.com/v1/Content`;

        while (nextPageUrl) {
            const twilioRes = await fetch(nextPageUrl, {
                method: 'GET',
                headers: { 'Authorization': authHeader }
            });

            if (!twilioRes.ok) break;
            const twilioData = await twilioRes.json();
            allContents = allContents.concat(twilioData.contents || []);
            nextPageUrl = twilioData.meta?.next_page_url || null; 
        }

        const formattedTemplates = await Promise.all(
            allContents.map(async (content) => {
                let approvalData = null;

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

                // 🚨 FIX: Use content.approval_status as live fallback instead of hardcoded "draft"
                let waData = {
                    status: content.approval_status || "draft",
                    category: "UTILITY",
                    rejection_reason: "",
                    name: content.friendly_name
                };

                if (approvalData && approvalData.whatsapp) {
                    waData = {
                        status: approvalData.whatsapp.status || content.approval_status || "draft",
                        category: approvalData.whatsapp.category || "UTILITY",
                        rejection_reason: approvalData.whatsapp.rejection_reason || "",
                        content_type: approvalData.whatsapp.content_type || "",
                        type: approvalData.whatsapp.type || "whatsapp",
                        name: approvalData.whatsapp.name || content.friendly_name
                    };
                }

                const types = content.types || {};
                let tType = "TEXT";
                if (types["whatsapp/card"]) tType = "WHATSAPP_CARD";
                else if (types["twilio/call-to-action"] || types["twilio/quick-reply"]) tType = "CALL_TO_ACTION";

                const typeKey = Object.keys(types)[0];
                let bodyText = "Content synced from Twilio";
                let headerType = "NONE";
                let headerText = "";
                let mediaUrl = "";
                let footerText = "";
                let buttons = [];

                if (typeKey && types[typeKey]) {
                    const typeData = types[typeKey];
                    if (typeData.body) bodyText = typeData.body;
                    if (typeData.footer) footerText = typeData.footer;

                    if (tType === "WHATSAPP_CARD") {
                        if (typeData.header_text) {
                            headerType = "TEXT";
                            headerText = typeData.header_text;
                        } else if (typeData.media && typeData.media.length > 0) {
                            headerType = "MEDIA";
                            mediaUrl = typeData.media[0];
                        }
                    }

                    if (typeData.actions) {
                        buttons = typeData.actions.map(action => {
                            if (action.url) return { type: "URL", title: action.title, value: action.url };
                            if (action.phone) return { type: "PHONE_NUMBER", title: action.title, value: action.phone };
                            return { type: "QUICK_REPLY", title: action.title, value: action.id };
                        });
                    }
                }

                return {
                    _id: content.sid,
                    sid: content.sid,
                    name: content.friendly_name || "Unnamed Template",
                    language: content.language || "en",
                    templateType: tType,
                    headerType,
                    headerText,
                    body: bodyText,
                    footerText,
                    mediaUrl,
                    buttons,
                    dateCreated: content.date_created,
                    dateUpdated: content.date_updated,
                    whatsapp: waData
                };
            })
        );

        return NextResponse.json({ success: true, data: formattedTemplates });
    } catch (error) {
        console.error("GET Global Twilio Templates Error:", error);
        return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
    }
}