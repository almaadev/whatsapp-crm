import { NextResponse } from "next/server";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";
import redis from "@/shared/lib/db/redis"; 
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
          number: body.number || "",
          department: body.department,
          branch: body.branch,
          isAdmin: body.isAdmin,
          active: body.active,
          accessModules: body.accessModules || [],
          preferredName: body.preferredName || ""
      }
    };

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