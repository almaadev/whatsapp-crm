import { NextResponse } from "next/server";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";
import redis from "@/shared/lib/db/redis"; 
import bcrypt from "bcryptjs"; 
import { isAdminAuthorized } from "@/shared/utils/auth";

const isAuthorized = (session) => {
    return isAdminAuthorized(session?.user?.role, session?.user?.department);
};

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!isAuthorized(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  
  try {
    await connectDB();
    const { id } = await params;
    
    const user = await User.findById(id).select("-password").lean();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    
    if (session.user.role !== 'superAdmin' && user.department === 'admin') {
        return NextResponse.json({ error: "Access Denied: Only Super Admins can manage other Admins" }, { status: 403 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!isAuthorized(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const existingUser = await User.findById(id).lean();
    if (!existingUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (session.user.role !== 'superAdmin') {
        if (existingUser.department === 'admin' || body.department === 'admin') {
            return NextResponse.json({ error: "Access Denied: Only Super Admin can manage Admins" }, { status: 403 });
        }
    }

    let updateData = {
      $set: {
          name: body.name,
          email: body.email,
          role: body.role,
          number: body.number || "",
          department: body.department,
          branch: body.branch,
          isAdmin: body.isAdmin,
          active: body.active,
          accessModules: body.accessModules || []
      }
    };

    // Handle Sender Number Assignments (Admin or Associate)
    const rawSenderNumbers = body.assignedSenderNumbers !== undefined 
      ? body.assignedSenderNumbers 
      : body.assignedSenderNumber !== undefined 
        ? (body.assignedSenderNumber ? [body.assignedSenderNumber] : [])
        : undefined;

    if (rawSenderNumbers !== undefined) {
      const TwilioNumber = (await import("@/shared/models/TwilioNumber")).default;

      const requestedSenderIds = Array.isArray(rawSenderNumbers)
        ? rawSenderNumbers.map((id) => (id._id || id).toString())
        : rawSenderNumbers ? [(rawSenderNumbers._id || rawSenderNumbers).toString()] : [];

      const targetRole = body.role !== undefined ? body.role : existingUser.role;
      const targetDept = body.department !== undefined ? body.department : existingUser.department;
      const targetIsAdmin = isAdminAuthorized(targetRole, targetDept);
      const isSuperAdminUser = session.user.role === "superAdmin";

      // If updating Associate (non-Admin) by Admin user (non-SuperAdmin), ensure all requested sender numbers belong to Admin's canonical pool
      if (!targetIsAdmin && !isSuperAdminUser) {
        const adminNumbers = await TwilioNumber.find({
          assignedAdmins: session.user.id,
          status: { $ne: "inactive" },
          isActive: { $ne: false },
        }).select("_id").lean();

        const adminAllowedSenderIds = new Set(
          adminNumbers.map((doc) => doc._id.toString())
        );

        for (const sendId of requestedSenderIds) {
          if (!adminAllowedSenderIds.has(sendId)) {
            return NextResponse.json(
              { error: "Forbidden: Associates can only be assigned sender numbers owned by their Admin." },
              { status: 403 }
            );
          }
        }
      }

      // Verify all requested numbers exist in DB
      if (requestedSenderIds.length > 0) {
        const foundCount = await TwilioNumber.countDocuments({ _id: { $in: requestedSenderIds } });
        if (foundCount !== requestedSenderIds.length) {
          return NextResponse.json({ error: "Invalid Twilio sender number ID(s) provided." }, { status: 400 });
        }
      }

      updateData.$set.assignedSenderNumbers = requestedSenderIds;
      updateData.$set.assignedTwilioNumbers = requestedSenderIds;
      if (requestedSenderIds.length > 0) {
        updateData.$set.assignedSenderNumber = requestedSenderIds[0];
      } else {
        updateData.$unset = { ...updateData.$unset, assignedSenderNumber: 1 };
      }
      updateData.$set.assignedBy = session.user.id;
      updateData.$set.assignedAt = new Date();

      if (targetIsAdmin) {
        // Sync assignedAdmins array on TwilioNumbers
        await TwilioNumber.updateMany(
          { assignedAdmins: id, _id: { $nin: requestedSenderIds } },
          { $pull: { assignedAdmins: id } }
        );
        if (requestedSenderIds.length > 0) {
          await TwilioNumber.updateMany(
            { _id: { $in: requestedSenderIds } },
            { $addToSet: { assignedAdmins: id } }
          );
        }
        // Ensure admin is removed from assignedAssociates
        await TwilioNumber.updateMany(
          { assignedAssociates: id },
          { $pull: { assignedAssociates: id } }
        );
      } else {
        // Sync assignedAssociates array on TwilioNumbers
        await TwilioNumber.updateMany(
          { assignedAssociates: id, _id: { $nin: requestedSenderIds } },
          { $pull: { assignedAssociates: id } }
        );
        if (requestedSenderIds.length > 0) {
          await TwilioNumber.updateMany(
            { _id: { $in: requestedSenderIds } },
            { $addToSet: { assignedAssociates: id } }
          );
        }
        // Ensure associate is never in assignedAdmins
        await TwilioNumber.updateMany(
          { assignedAdmins: id },
          { $pull: { assignedAdmins: id } }
        );
      }
    }

    if (body.preferredName && body.preferredName.trim() !== "") {
        updateData.$set.preferredName = body.preferredName.trim();
    } else {
        updateData.$unset = { ...updateData.$unset, preferredName: 1 };
    }

    if (body.password && body.password.trim() !== "") {
      const salt = await bcrypt.genSalt(Number(process.env.SALT || 10));
      updateData.$set.password = await bcrypt.hash(body.password, salt);
    }

    await User.findByIdAndUpdate(id, updateData, { returnDocument: 'after', runValidators: true });
    if (redis && redis.status === 'ready') await redis.del("users:all");

    return NextResponse.json({ success: true });
  } catch (error) {
   if (error.code === 11000 && error.keyValue) {
        
        const duplicateField = Object.keys(error.keyValue)[0];
        
        let displayField = duplicateField;
        if (duplicateField === 'preferredName') displayField = 'Preferred Name';
        else if (duplicateField === 'email') displayField = 'Email';
        else if (duplicateField === 'phone') displayField = 'Phone Number';

        return NextResponse.json({ 
            error: `This ${displayField} is already registered. Please provide a different ${displayField}.` 
        }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}