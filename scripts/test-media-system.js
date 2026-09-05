import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Message from "../src/shared/models/Message.js";
import Media from "../src/shared/models/Media.js";
import cloudinaryService, {
  uploadMediaToCloudinary,
  getCloudinaryFolder,
  getCloudinaryResourceType,
  formatCloudinaryAttachmentUrl,
  validateMediaUrl,
} from "../src/server/services/cloudinaryService.js";
import mediaCleanupService from "../src/server/services/mediaCleanupService.js";
import inboundMessageService from "../src/server/services/inboundMessageService.js";
import { sendWhatsAppMessage } from "../src/features/admin/services/twilioService.js";
import { POST as postMediaUpload } from "../src/app/api/media/upload/route.js";
import { POST as postChats } from "../src/app/api/chats/route.js";
import { GET as getAdminMedia, DELETE as deleteAdminMedia } from "../src/app/api/admin/media/route.js";

async function runMediaSystemTestSuite() {
  console.log("\n==================================================");
  console.log("📸 COMPREHENSIVE MEDIA STORAGE ARCHITECTURE TEST SUITE");
  console.log("==================================================\n");

  await connectDB();
  process.env.TWILIO_VALIDATE_SIGNATURE = "false";

  let passed = 0;
  let failed = 0;

  async function check(testNum, title, fn) {
    try {
      process.stdout.write(`⏳ Test ${testNum}: ${title}... `);
      await fn();
      console.log("✅ PASSED");
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      console.error(err);
      failed++;
    }
  }

  const testPhone = "whatsapp:+919876543210";
  const dummySender = "+917401403011";

  // Cleanup test records beforehand
  await Customer.deleteMany({ phone: testPhone });
  await Message.deleteMany({ phone: testPhone });
  await Media.deleteMany({ phone: testPhone });

  // 1. JPG upload -> whatsapp-crm/images
  await check(1, "JPG upload -> whatsapp-crm/images (resource_type: image)", async () => {
    const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const res = await uploadMediaToCloudinary(jpgBuffer, {
      mediaType: "image",
      mimeType: "image/jpeg",
      originalFileName: "sample_photo.jpg",
    });
    if (!res.secureUrl || !res.publicId) throw new Error("Missing secureUrl or publicId");
    if (res.resourceType !== "image" || res.cloudinaryResourceType !== "image") {
      throw new Error(`Expected resourceType image, got ${res.resourceType}`);
    }
    if (res.folder !== "whatsapp-crm/images") {
      throw new Error(`Expected folder whatsapp-crm/images, got ${res.folder}`);
    }
    if (!res.publicId.includes("whatsapp-crm/images/")) {
      throw new Error(`Public ID missing folder prefix: ${res.publicId}`);
    }
  });

  // 2. PNG upload -> whatsapp-crm/images
  await check(2, "PNG upload -> whatsapp-crm/images (resource_type: image)", async () => {
    const pngBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const res = await uploadMediaToCloudinary(pngBuffer, {
      mediaType: "image",
      mimeType: "image/png",
      originalFileName: "prescription_scan.png",
    });
    if (!res.secureUrl) throw new Error("Missing secureUrl for PNG");
    if (res.resourceType !== "image") throw new Error(`Expected resourceType image, got ${res.resourceType}`);
    if (res.folder !== "whatsapp-crm/images") throw new Error(`Expected folder whatsapp-crm/images, got ${res.folder}`);
  });

  // 3. MP4 upload -> whatsapp-crm/videos
  await check(3, "MP4 upload -> whatsapp-crm/videos (resource_type: video)", async () => {
    const videoBuffer = Buffer.from("ftypisom\x00\x00\x02\x00isomiso2mp41");
    const res = await uploadMediaToCloudinary(videoBuffer, {
      mediaType: "video",
      mimeType: "video/mp4",
      originalFileName: "treatment_exercise.mp4",
    });
    if (!res.secureUrl) throw new Error("Missing secureUrl for video");
    if (res.resourceType !== "video") throw new Error(`Expected resourceType video, got ${res.resourceType}`);
    if (res.folder !== "whatsapp-crm/videos") throw new Error(`Expected folder whatsapp-crm/videos, got ${res.folder}`);
    if (!res.publicId.includes("whatsapp-crm/videos/")) throw new Error(`Public ID missing videos folder: ${res.publicId}`);
  });

  // 4. MP3 upload -> whatsapp-crm/audio
  await check(4, "MP3/Audio upload -> whatsapp-crm/audio (resource_type: video/audio)", async () => {
    const audioBuffer = Buffer.from("OggS\x00\x02\x00\x00\x00\x00\x00\x00");
    const res = await uploadMediaToCloudinary(audioBuffer, {
      mediaType: "audio",
      mimeType: "audio/mp3",
      originalFileName: "doctor_consultation.mp3",
    });
    if (!res.secureUrl) throw new Error("Missing secureUrl for audio");
    if (res.resourceType !== "video") throw new Error(`Expected resourceType video for audio, got ${res.resourceType}`);
    if (res.folder !== "whatsapp-crm/audio") throw new Error(`Expected folder whatsapp-crm/audio, got ${res.folder}`);
    if (!res.publicId.includes("whatsapp-crm/audio/")) throw new Error(`Public ID missing audio folder: ${res.publicId}`);
  });

  // 5. PDF upload -> whatsapp-crm/documents
  await check(5, "PDF upload -> whatsapp-crm/documents (resource_type: raw, public_id ends with .pdf)", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
    const res = await uploadMediaToCloudinary(pdfBuffer, {
      mediaType: "document",
      mimeType: "application/pdf",
      originalFileName: "Invoice_AHL2026-246.pdf",
    });
    if (!res.secureUrl) throw new Error("Missing secureUrl for PDF");
    if (res.resourceType !== "raw" || res.cloudinaryResourceType !== "raw") {
      throw new Error(`Expected resourceType raw for PDF, got ${res.resourceType}`);
    }
    if (res.folder !== "whatsapp-crm/documents") {
      throw new Error(`Expected folder whatsapp-crm/documents, got ${res.folder}`);
    }
    if (!res.publicId.endsWith(".pdf")) {
      throw new Error(`Expected PDF publicId to end with .pdf extension, got ${res.publicId}`);
    }
  });

  // 6. POST /api/media/upload persists MongoDB Media record immediately
  let uploadedMediaRecord = null;
  await check(6, "POST /api/media/upload creates MongoDB Media record and returns metadata", async () => {
    const fd = new FormData();
    const pdfBlob = new Blob(["%PDF-1.4 Invoice Test Data"], { type: "application/pdf" });
    const pdfFile = new File([pdfBlob], "Invoice_AHL2026-246.pdf", { type: "application/pdf" });
    fd.append("file", pdfFile);
    fd.append("mediaType", "document");
    fd.append("phone", testPhone);

    const req = new Request("http://localhost:3000/api/media/upload", {
      method: "POST",
      body: fd,
    });

    const res = await postMediaUpload(req);
    const json = await res.json();
    if (!json.success || !json.media?.id) {
      throw new Error("Upload API failed: " + (json.message || "Unknown error"));
    }

    uploadedMediaRecord = json.media;

    // Verify MongoDB document existence
    const dbDoc = await Media.findById(uploadedMediaRecord.id).lean();
    if (!dbDoc) throw new Error("Media document not found in MongoDB!");
    if (dbDoc.originalFilename !== "Invoice_AHL2026-246.pdf") {
      throw new Error(`Expected originalFilename Invoice_AHL2026-246.pdf, got ${dbDoc.originalFilename}`);
    }
    if (dbDoc.resourceType !== "raw") {
      throw new Error(`Expected MongoDB resourceType raw, got ${dbDoc.resourceType}`);
    }
    if (dbDoc.folder !== "whatsapp-crm/documents") {
      throw new Error(`Expected folder whatsapp-crm/documents, got ${dbDoc.folder}`);
    }
  });

  // 7. Send PDF through WhatsApp using Media document ID
  await check(7, "Send PDF via POST /api/chats using mediaId and permanent Cloudinary secureUrl", async () => {
    if (!uploadedMediaRecord) throw new Error("Missing uploadedMediaRecord from previous test");

    const req = new Request("http://localhost:3000/api/chats", {
      method: "POST",
      body: JSON.stringify({
        phone: testPhone,
        message: "Your invoice is ready",
        mediaId: uploadedMediaRecord.id,
        senderNumber: dummySender,
      }),
    });

    const res = await postChats(req);
    const json = await res.json();
    if (!json.success) throw new Error("POST /api/chats failed: " + json.message);

    // Verify message persistence and linking
    const savedMsg = await Message.findOne({ phone: testPhone, messageType: "document" }).lean();
    if (!savedMsg) throw new Error("Saved message not found in database");
    if (!savedMsg.mediaUrl || !savedMsg.mediaUrl.includes("cloudinary.com")) {
      throw new Error(`Expected permanent Cloudinary mediaUrl, got ${savedMsg.mediaUrl}`);
    }

    // Verify Media document is linked to messageId
    const updatedMedia = await Media.findById(uploadedMediaRecord.id).lean();
    if (!updatedMedia.messageId || String(updatedMedia.messageId) !== String(savedMsg._id)) {
      throw new Error("Media document messageId link was not updated!");
    }
  });

  // 8. Send image through WhatsApp
  await check(8, "Send image through Twilio sendWhatsAppMessage with permanent URL", async () => {
    const imageUrl = "https://res.cloudinary.com/crm-media/whatsapp-crm/images/photo_sample.jpg";
    const sent = await sendWhatsAppMessage(testPhone, "Prescription photo", {
      senderNumber: dummySender,
      mediaUrl: imageUrl,
      user: { role: "superAdmin" },
    });
    if (!sent.sid && !sent.id) throw new Error("Twilio image message send failed");
  });

  // 9. Send video through WhatsApp
  await check(9, "Send video through Twilio sendWhatsAppMessage with permanent URL", async () => {
    const videoUrl = "https://res.cloudinary.com/crm-media/whatsapp-crm/videos/exercise.mp4";
    const sent = await sendWhatsAppMessage(testPhone, "Exercise video", {
      senderNumber: dummySender,
      mediaUrl: videoUrl,
      user: { role: "superAdmin" },
    });
    if (!sent.sid && !sent.id) throw new Error("Twilio video message send failed");
  });

  // 10. Send audio through WhatsApp
  await check(10, "Send audio through Twilio sendWhatsAppMessage with permanent URL", async () => {
    const audioUrl = "https://res.cloudinary.com/crm-media/whatsapp-crm/audio/voice.mp3";
    const sent = await sendWhatsAppMessage(testPhone, "Doctor audio note", {
      senderNumber: dummySender,
      mediaUrl: audioUrl,
      user: { role: "superAdmin" },
    });
    if (!sent.sid && !sent.id) throw new Error("Twilio audio message send failed");
  });

  // 11. Reject blob / local filesystem URLs before Twilio
  await check(11, "Twilio service rejects blob / local filesystem URLs", async () => {
    let threw = false;
    try {
      await sendWhatsAppMessage(testPhone, "Test bad url", {
        senderNumber: dummySender,
        mediaUrl: "blob:http://localhost:3000/1234-5678",
        user: { role: "superAdmin" },
      });
    } catch (e) {
      threw = true;
    }
    if (!threw) throw new Error("Did not reject blob URL");
  });

  // 12. Delete each media type with correct Cloudinary resourceType
  await check(12, "Delete media records with correct Cloudinary resourceType (image, video, raw)", async () => {
    const testDocs = await Media.create([
      {
        phone: testPhone,
        mediaType: "image",
        mimeType: "image/jpeg",
        originalFilename: "del_img.jpg",
        cloudinaryUrl: "https://res.cloudinary.com/crm-media/whatsapp-crm/images/del_img.jpg",
        cloudinaryPublicId: "whatsapp-crm/images/del_img",
        resourceType: "image",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
      {
        phone: testPhone,
        mediaType: "video",
        mimeType: "video/mp4",
        originalFilename: "del_vid.mp4",
        cloudinaryUrl: "https://res.cloudinary.com/crm-media/whatsapp-crm/videos/del_vid.mp4",
        cloudinaryPublicId: "whatsapp-crm/videos/del_vid",
        resourceType: "video",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
      {
        phone: testPhone,
        mediaType: "document",
        mimeType: "application/pdf",
        originalFilename: "del_doc.pdf",
        cloudinaryUrl: "https://res.cloudinary.com/crm-media/raw/upload/whatsapp-crm/documents/del_doc.pdf",
        cloudinaryPublicId: "whatsapp-crm/documents/del_doc.pdf",
        resourceType: "raw",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    ]);

    const idsToDelete = testDocs.map((d) => d._id.toString());
    const mockDelReq = new Request("http://localhost:3000/api/admin/media", {
      method: "DELETE",
      body: JSON.stringify({ ids: idsToDelete }),
    });

    const delRes = await deleteAdminMedia(mockDelReq);
    const delJson = await delRes.json();
    if (!delJson.success || delJson.deletedCount !== 3) {
      throw new Error(`Expected 3 deleted, got ${delJson.deletedCount}`);
    }

    const checkDocs = await Media.find({ _id: { $in: idsToDelete } });
    for (const d of checkDocs) {
      if (d.status !== "DELETED") throw new Error(`Media doc ${d._id} status is not DELETED`);
    }
  });

  // 13. Admin Media panel queries directly from MongoDB
  await check(13, "Admin Media panel loads stored files from MongoDB", async () => {
    const mockReq = new Request("http://localhost:3000/api/admin/media?page=1&limit=25");
    const res = await getAdminMedia(mockReq);
    const json = await res.json();
    if (!json.success || !json.stats || !Array.isArray(json.data)) {
      throw new Error("Admin media API returned invalid format");
    }
  });

  console.log("\n==================================================");
  console.log(`📊 RESULTS: ${passed} PASSED | ${failed} FAILED | TOTAL 13 TESTS`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runMediaSystemTestSuite()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test Suite Fatal Error:", e);
    process.exit(1);
  });
