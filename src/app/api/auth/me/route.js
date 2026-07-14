import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";
import { encrypt } from "@/shared/utils/crypto";

const ENCRYPTION_PASSWORD = process.env.NEXT_PUBLIC_API_ENCRYPTION_KEY || "AlmaaHerbalCRMSecurityKey2026";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const dbUser = await User.findById(session.user.id).lean();

    if (!dbUser || dbUser.active === false) {
      return NextResponse.json({ error: "Suspended" }, { status: 403 });
    }

    const user = {
      ...session.user,
      id: dbUser._id.toString(),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      department: dbUser.department,
      accessModules: dbUser.accessModules,
    };

    const encryptedData = await encrypt(JSON.stringify(user), ENCRYPTION_PASSWORD);

    return NextResponse.json({ data: encryptedData }, { status: 200 });
  } catch (error) {
    console.error("Error fetching current user:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

