import twilio from "twilio";

let twilioClientInstance = null;

export function getTwilioClient() {
  if (!twilioClientInstance) {
    twilioClientInstance = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClientInstance;
}

export function getStatusCallbackUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL 
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status` 
    : "https://nonarsenic-nonparous-clotilde.ngrok-free.dev/api/webhook/status"; // fallback for local dev
}

export async function sendWhatsAppMessage(to, body) {
  const client = getTwilioClient();
  const from = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
  
  return await client.messages.create({
    body,
    from,
    to,
    statusCallback: getStatusCallbackUrl()
  });
}

export async function sendTemplateMessage(to, templateSid, contentVariables = {}) {
  const client = getTwilioClient();
  const from = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
  
  return await client.messages.create({
    contentSid: templateSid,
    from,
    to,
    contentVariables: JSON.stringify(contentVariables),
    statusCallback: getStatusCallbackUrl()
  });
}
