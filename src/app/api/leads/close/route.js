import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
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

    // 1. ADDED: Await the update and check if it found the customer
    const updatedCustomer = await Customer.findOneAndUpdate(
      { phone: cleanPhone },
      {
        isClosed: newStateBoolean,
        status: newStateBoolean ? "Closed" : "Follow Up",
        lastClosedBy: newStateBoolean ? session.user.name : ""
      },
      { new: true } // Returns the updated document
    );

    if (!updatedCustomer) {
      return NextResponse.json({ error: "Customer not found in Database" }, { status: 404 });
    }

    // 2. Clear Caches
    try { 
        await redis.del("chats:all_data"); 
        // Unga leads page kaga vera ethavathu redis key irundhal athayum delete pannunga
        // await redis.del("leads:all"); 
    } catch (e) {
        console.error("Redis delete error:", e);
    }

    // 3. Clear Next.js UI Cache
    revalidatePath("/dashboard/leads");
    revalidatePath("/dashboard/chat");
    revalidatePath(`/dashboard/leads/${encodeURIComponent(cleanPhone)}`); // Specific lead page cache clearance

    return NextResponse.json({ success: true, newState: newStateBoolean ? "TRUE" : "FALSE" });
  } catch (error) {
    console.error("Update Close Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}