import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead";
import User from "@/models/User";
import redis from "@/lib/redis";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { mobile, currentState } = await req.json();
    if (!mobile)
      return NextResponse.json({ error: "Mobile required" }, { status: 400 });

    let cleanPhone = mobile.toString().trim();
    if (!cleanPhone.startsWith("whatsapp:"))
      cleanPhone = `whatsapp:${cleanPhone}`;

    const findUserNameById = async (id) => {
      const user = await User.findById(id).lean();
      return user ? user.name : "Unknown";
    };
    await connectDB();
    const newStateBoolean = currentState !== "TRUE"; // Toggle Action

    // 2. Prepare the update data
    const updateData = {
      isClosed: newStateBoolean,
      status: newStateBoolean ? "Closed" : "Follow Up",
      lastClosedBy: newStateBoolean ? await findUserNameById(session.user.id) : "",
    };

    // 3. If closing, set priority to empty string (null equivalent for Strings)
    if (newStateBoolean) {
      updateData.priority = "";
    }

    // 4. Update Customer
    const updatedCustomer = await Customer.findOneAndUpdate(
      { phone: cleanPhone },
      updateData,
      { new: true }, // Returns the updated document
    );

    if (!updatedCustomer) {
      return NextResponse.json(
        { error: "Customer not found in Database" },
        { status: 404 },
      );
    }

    // 5. Update Lead collection as well
    await Lead.updateMany({ phone: cleanPhone }, updateData);

    // 6. Clear Caches
    try {
      await redis.del("chats:all_data");
    } catch (e) {
      console.error("Redis delete error:", e);
    }

    // 7. Clear Next.js UI Cache
    revalidatePath("/crm/leads");
    revalidatePath("/crm/chat");
    revalidatePath(`/crm/leads/${encodeURIComponent(cleanPhone)}`);

    return NextResponse.json({
      success: true,
      newState: newStateBoolean ? "TRUE" : "FALSE",
    });
  } catch (error) {
    console.error("Update Close Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
