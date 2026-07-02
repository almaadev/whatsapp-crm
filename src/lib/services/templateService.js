import fs from "fs";
import path from "path";

const getAuthHeader = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
};

export const templateService = {
  async fetchTwilioTemplates() {
    const authHeader = getAuthHeader();
    let allContents = [];
    let nextPageUrl = `https://content.twilio.com/v1/Content`;

    while (nextPageUrl) {
      const twilioRes = await fetch(nextPageUrl, { method: 'GET', headers: { 'Authorization': authHeader } });
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
            const approvalRes = await fetch(content.links.approval_fetch, { method: 'GET', headers: { 'Authorization': authHeader } });
            if (approvalRes.ok) approvalData = await approvalRes.json();
          } catch (e) {}
        }

        let waData = { status: content.approval_status || "draft", category: "UTILITY", rejection_reason: "", name: content.friendly_name };
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
        let headerType = "NONE", headerText = "", mediaUrl = "", footerText = "", buttons = [];

        if (typeKey && types[typeKey]) {
          const typeData = types[typeKey];
          if (typeData.body) bodyText = typeData.body;
          if (typeData.footer) footerText = typeData.footer;

          if (tType === "WHATSAPP_CARD") {
            if (typeData.header_text) { headerType = "TEXT"; headerText = typeData.header_text; }
            else if (typeData.media && typeData.media.length > 0) { headerType = "MEDIA"; mediaUrl = typeData.media[0]; }
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
          _id: content.sid, sid: content.sid, name: content.friendly_name || "Unnamed Template",
          language: content.language || "en", templateType: tType, headerType, headerText,
          body: bodyText, footerText, mediaUrl, buttons, dateCreated: content.date_created,
          dateUpdated: content.date_updated, whatsapp: waData
        };
      })
    );
    return formattedTemplates;
  },

  async createTwilioTemplate(data, baseUrl) {
    const { friendly_name, body, category, language, templateType, headerType, headerText, footerText, variables, buttons, imageFile } = data;
    const authHeader = getAuthHeader();
    let mediaUrl = "";

    if (imageFile && imageFile.arrayBuffer) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const fileName = `${Date.now()}_${imageFile.name.replace(/\s+/g, '_')}`;
      const uploadDir = path.join(process.cwd(), "src", "app", "uploads", "templates");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, fileName), buffer);
      
      let base = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      base = base.replace(/\/+$/, "");
      mediaUrl = `${base}/api/uploads/templates/${fileName}`;
      if (!mediaUrl.startsWith("http")) mediaUrl = "https://" + mediaUrl;
    }

    let types = {};
    const formattedActions = buttons && buttons.length > 0 ? buttons.map(b => {
      const action = { type: b.type, title: b.title };
      if (b.type === 'URL') action.url = b.value;
      if (b.type === 'PHONE_NUMBER') action.phone = b.value;
      if (b.type === 'QUICK_REPLY') action.id = b.title.toLowerCase().replace(/[^a-z0-9]/g, '_') || `qr_${Date.now()}`;
      return action;
    }) : undefined;

    if (templateType === 'WHATSAPP_CARD') {
      types["whatsapp/card"] = { body };
      if (footerText) types["whatsapp/card"].footer = footerText;
      if (headerType === 'MEDIA' && mediaUrl) types["whatsapp/card"].media = [mediaUrl];
      else if (headerType === 'TEXT' && headerText) types["whatsapp/card"].header_text = headerText;
      if (formattedActions) types["whatsapp/card"].actions = formattedActions;
    } else if (templateType === 'CALL_TO_ACTION' || (formattedActions && formattedActions.length > 0)) {
      let finalBody = body;
      if (headerType === 'TEXT' && headerText) finalBody = `*${headerText}*\n\n${finalBody}`;
      if (footerText) finalBody = `${finalBody}\n\n_${footerText}_`;
      if (buttons && buttons.some(b => b.type === 'QUICK_REPLY')) types["twilio/quick-reply"] = { body: finalBody, actions: formattedActions };
      else types["twilio/call-to-action"] = { body: finalBody, actions: formattedActions };
    } else {
      let finalBody = body;
      if (headerType === 'TEXT' && headerText) finalBody = `*${headerText}*\n\n${finalBody}`;
      if (footerText) finalBody = `${finalBody}\n\n_${footerText}_`;
      types["twilio/text"] = { body: finalBody };
    }

    const payload = { friendly_name, language, types };
    if (Object.keys(variables || {}).length > 0) payload.variables = variables;

    const createRes = await fetch(`https://content.twilio.com/v1/Content`, {
      method: 'POST', headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resData = await createRes.json();
    if (!createRes.ok) throw new Error(resData.message || "Twilio API Error");

    const approvalRes = await fetch(`https://content.twilio.com/v1/Content/${resData.sid}/ApprovalRequests/whatsapp`, {
      method: 'POST', headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: friendly_name.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 512),
        category: category 
      })
    });

    return { success: true, contentSid: resData.sid, approvalStatus: approvalRes.ok ? "pending" : "failed_submission" };
  },

  async deleteTwilioTemplate(sid) {
    const authHeader = getAuthHeader();
    const twilioRes = await fetch(`https://content.twilio.com/v1/Content/${sid}`, {
      method: 'DELETE', headers: { 'Authorization': authHeader }
    });
    if (!twilioRes.ok) throw new Error("Twilio API Error");
    return { success: true };
  }
};
