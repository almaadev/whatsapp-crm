// src/app/api/customers/[phone]/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const body = await req.json();
    
    // ✨ NEXT.JS 15 FIX: Params-ai await panni thaan edukkanum
    const resolvedParams = await params; 
    const phoneDigits = resolvedParams.phone.replace(/\D/g, '');

    // CUSTOMER collection-la mattum thedi UPDATE pandrom
    const updatedCustomer = await Customer.findOneAndUpdate(
      { phone: { $regex: phoneDigits } }, 
      {
        $set: {
          name: body.name,
          city: body.city,
          address: body.address,
          source: body.source,
          enquiredFor: body.enquiredFor,
          status: body.status,
          saleAmount: body.saleAmount,
          remarks: body.remarks
        }
      },
      { new: true }
    );

    if (!updatedCustomer) {
      return NextResponse.json({ error: "Customer not found in Customer DB" }, { status: 404 });
    }

    return NextResponse.json({ success: true, customer: updatedCustomer });
  } catch (error) {
    console.error("Customer Update Error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}