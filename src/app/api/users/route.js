import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis"; 

const USER_CACHE_KEY = "users:all";

// ... (keep getSheets helper) ...
const getSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. CHECK REDIS
    const cachedUsers = await redis.get(USER_CACHE_KEY);
    if (cachedUsers) return NextResponse.json(JSON.parse(cachedUsers));

    // 2. FETCH GOOGLE
    const sheets = getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Users!A:G", 
    });

    const rows = response.data.values || [];
    const users = rows.slice(1).map((row, index) => ({
      id: index + 2, 
      name: row[0],
      email: row[1],
      role: row[3],
      leads: parseInt(row[4] || "0"),
      target: parseInt(row[5] || "0"),
      achieved: parseInt(row[6] || "0"),
    }));

    const associates = users.filter(u => u.role !== 'admin');

    // 3. SET REDIS (Cache for 1 hour)
    await redis.set(USER_CACHE_KEY, JSON.stringify(associates), "EX", 3600);

    return NextResponse.json(associates);
  } catch (error) {
    console.error("GET Users Error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req) {
  // ... (keep auth checks) ...
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    // ... (keep logic) ...
    const body = await req.json();
    const { name, email, password, role } = body;
    const sheets = getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID 

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Users!A:G",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[ name, email, password, role, 0, 0, 0 ]] },
    });

    // INVALIDATE CACHE
    await redis.del(USER_CACHE_KEY);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  // ... (keep auth checks and logic) ...
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { rowId, target, leads, achieved } = await req.json();
    const sheets = getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID 

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Users!E${rowId}:G${rowId}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[ leads, target, achieved ]] },
    });

    // INVALIDATE CACHE
    await redis.del(USER_CACHE_KEY);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Update Failed" }, { status: 500 });
  }
}