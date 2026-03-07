import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";

export async function GET() {
  try {
    // MongoDB-யை கனெக்ட் செய்ய முயற்சிக்கிறோம்
    await connectDB();
    
    return NextResponse.json({ 
        success: true, 
        message: "✅ MongoDB Connected Successfully!" 
    });
    
  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json({ 
        success: false, 
        message: "❌ MongoDB Connection Failed", 
        error: error.message 
    }, { status: 500 });
  }
}