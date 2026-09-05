import connectDB from "../../shared/lib/db/mongodb.js";
import Media from "../../shared/models/Media.js";
import Message from "../../shared/models/Message.js";
import cloudinaryService from "./cloudinaryService.js";

export const mediaCleanupService = {
  /**
   * Executes the 60-day retention media cleanup.
   * Deletes expired assets from Cloudinary and marks MongoDB records as EXPIRED.
   */
  async runCleanup() {
    await connectDB();
    const now = new Date();

    console.log(`[MEDIA-CLEANUP] Starting cleanup for assets expired before ${now.toISOString()}...`);

    const expiredMedia = await Media.find({
      expiresAt: { $lte: now },
      status: { $ne: "DELETED" },
    }).limit(200);

    let deletedCount = 0;
    let failedCount = 0;
    const deletedIds = [];

    for (const mediaDoc of expiredMedia) {
      try {
        // 1. Delete from Cloudinary if public ID exists
        if (mediaDoc.cloudinaryPublicId) {
          await cloudinaryService.deleteResource(
            mediaDoc.cloudinaryPublicId,
            mediaDoc.resourceType || "image"
          ).catch((e) => {
            console.warn(`[MEDIA-CLEANUP] Cloudinary delete warning for ${mediaDoc.cloudinaryPublicId}:`, e.message);
          });
        }

        // 2. Mark Media document as EXPIRED / DELETED
        mediaDoc.status = "EXPIRED";
        await mediaDoc.save();

        // 3. Update associated Message document gracefully
        if (mediaDoc.messageId) {
          await Message.findByIdAndUpdate(mediaDoc.messageId, {
            $set: {
              "media.status": "EXPIRED",
              "media.url": null,
            },
          }).catch(() => {});
        } else if (mediaDoc.phone) {
          // If no messageId reference, search by cloudinaryUrl or publicId
          await Message.updateMany(
            {
              $or: [
                { "media.publicId": mediaDoc.cloudinaryPublicId },
                { mediaUrl: mediaDoc.cloudinaryUrl },
              ],
            },
            {
              $set: {
                "media.status": "EXPIRED",
                "media.url": null,
              },
            }
          ).catch(() => {});
        }

        deletedCount++;
        deletedIds.push(mediaDoc._id.toString());
      } catch (err) {
        failedCount++;
        console.error(`❌ [MEDIA-CLEANUP] Failed to cleanup media ${mediaDoc._id}:`, err.message);
      }
    }

    const summary = {
      timestamp: now.toISOString(),
      checkedCount: expiredMedia.length,
      deletedCount,
      failedCount,
      deletedIds,
    };

    console.log(`[MEDIA-CLEANUP] Finished. Deleted ${deletedCount} expired assets, ${failedCount} errors.`);
    return summary;
  },
};

export default mediaCleanupService;
