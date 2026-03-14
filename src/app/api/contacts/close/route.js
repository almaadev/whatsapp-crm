import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead"; // 1. Added Lead Model
import redis from "@/lib/redis"; 

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { mobile, currentState } = await req.json();
    if (!mobile) return NextResponse.json({ error: "Mobile required" }, { status: 400 });

    let cleanPhone = mobile.toString().trim();
    if (!cleanPhone.startsWith("whatsapp:")) cleanPhone = `whatsapp:${cleanPhone}`;

    await connectDB();
    const newStateBoolean = currentState !== "TRUE"; // Toggle Action

    // 2. Prepare the update data
    const updateData = {
      isClosed: newStateBoolean,
      status: newStateBoolean ? "Closed" : "Follow Up",
      lastClosedBy: newStateBoolean ? session.user.name : ""
    };

    // 3. If closing, set priority to empty string
    if (newStateBoolean) {
      updateData.priority = "";
    }

    // 4. Update Customer
    await Customer.findOneAndUpdate(
      { phone: cleanPhone },
      updateData
    );

    // 5. Update Lead
    await Lead.updateMany(
      { phone: cleanPhone },
      updateData
    );

    try { await redis.del("chats:all_data"); } catch (e) {}

    return NextResponse.json({ success: true, newState: newStateBoolean ? "TRUE" : "FALSE" });
  } catch (error) {
    console.error("Update Close Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}