import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req, { params }) {
  try {
    // 🚀 Unwrap params for Next.js 15 compatibility
    const { filename } = await params; 
    
    // Point to your exact folder
    const filePath = path.join(process.cwd(), "src", "app", "uploads", "templates", filename);

    // If the file doesn't exist, return 404
    if (!fs.existsSync(filePath)) {
      return new NextResponse("Image not found", { status: 404 });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath);

    // Determine the correct Content-Type for Twilio
    const ext = path.extname(filename).toLowerCase();
    let mimeType = "image/jpeg";
    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".gif") mimeType = "image/gif";
    else if (ext === ".pdf") mimeType = "application/pdf";
    else if (ext === ".mp4") mimeType = "video/mp4";

    // Serve the file directly
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Image Serving Error:", error);
    return new NextResponse("Server Error", { status: 500 });
  }
}