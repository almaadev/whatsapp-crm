import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import redis from "@/lib/db/redis";
import { cookies } from "next/headers";

export async function POST(req) {
    try {
        // 1. Extract the token to get the JTI (JWT ID) and user info
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        
        if (token) {
            const jti = token.jti;
            const userId = token.id || token.sub;
            const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
            
            // 2. Blacklist the JWT in Redis (if Redis is available and JTI exists)
            if (jti && redis && redis.status === "ready") {
                // Blacklist until the token naturally expires, or default to 24h
                const expTime = token.exp ? token.exp - Math.floor(Date.now() / 1000) : 86400;
                if (expTime > 0) {
                    await redis.setex(`blacklist:${jti}`, expTime, "revoked");
                }
            }

        }

        const cookieStore = await cookies(); 
        
        const authCookies = [
            "next-auth.session-token",
            "__Secure-next-auth.session-token",
            "next-auth.csrf-token",
            "__Host-next-auth.csrf-token",
            "next-auth.callback-url",
            "__Secure-next-auth.callback-url"
        ];

        for (const cookieName of authCookies) {
            if (cookieStore.has(cookieName)) {
                cookieStore.delete(cookieName);
            }
        }

        return NextResponse.json({ success: true, message: "Session securely invalidated across all layers." });
    } catch (error) {
        console.error("[LOGOUT API ERROR]", error);
        
        const response = NextResponse.json({ error: "Failed to process logout fully, forcing cookie clear." }, { status: 500 });
        response.cookies.delete("next-auth.session-token");
        response.cookies.delete("__Secure-next-auth.session-token");
        return response;
    }
}