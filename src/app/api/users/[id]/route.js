import { NextResponse } from "next/server";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import redis from "@/lib/redis"; 
import bcrypt from "bcryptjs"; 

const isAuthorized = (session) => {
    return session?.user?.role === 'superAdmin' || 
           (session?.user?.role === 'sales' && session?.user?.department === 'admin') ||  
           (session?.user?.role === 'doctor' && session?.user?.department === 'admin');
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
<<<<<<< HEAD
=======
          number: body.number,
>>>>>>> c1be5bc (Initial commit from new system)
          department: body.department,
          branch: body.branch,
          isAdmin: body.isAdmin,
          active: body.active,
          accessModules: body.accessModules || []
      },
      $unset: {} 
    };

    if (body.preferredName && body.preferredName.trim() !== "") {
        updateData.$set.preferredName = body.preferredName.trim();
    } else {
        updateData.$unset.preferredName = "";
    }

<<<<<<< HEAD
    if (body.number && body.number.trim() !== "") {
        updateData.$set.number = body.number.trim();
    } else {
        updateData.$unset.number = "";
    }
=======
    // if (body.number && body.number.trim() !== "") {
    //     updateData.$set.number = body.number.trim();
    // } else {
    //     updateData.$unset.number = "";
    // }
>>>>>>> c1be5bc (Initial commit from new system)

    if (body.password && body.password.trim() !== "") {
      const salt = await bcrypt.genSalt(Number(process.env.SALT || 10));
      updateData.$set.password = await bcrypt.hash(body.password, salt);
    }

    if (Object.keys(updateData.$unset).length === 0) {
        delete updateData.$unset;
    }

    await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (redis && redis.status === 'ready') await redis.del("users:all");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === 11000) {
        return NextResponse.json({ error: "Email, Number or Preferred Name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}