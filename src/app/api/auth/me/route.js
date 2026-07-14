import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/session";
import { encrypt } from "@/shared/utils/crypto";

const ENCRYPTION_PASSWORD = process.env.NEXT_PUBLIC_API_ENCRYPTION_KEY;

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

