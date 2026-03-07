import { NextResponse } from "next/server";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import redis from "@/lib/redis"; 
import bcrypt from "bcryptjs"; // NEW: Security Layer

const USER_CACHE_KEY = "users:all";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (redis && redis.status === 'ready') {
        const cachedUsers = await redis.get(USER_CACHE_KEY);
        if (cachedUsers) return NextResponse.json(JSON.parse(cachedUsers));
    }

    await connectDB();
    const users = await User.find({ role: { $ne: 'admin' } }).lean();

    const associates = users.map(u => ({
      id: u._id.toString(), 
      name: u.name,
      email: u.email,
      role: u.role,
      leads: u.leads || 0,
      target: u.target || 0,
      achieved: u.achieved || 0,
    }));

    if (redis && redis.status === 'ready') {
        await redis.set(USER_CACHE_KEY, JSON.stringify(associates), "EX", 3600);
    }

    return NextResponse.json(associates);
  } catch (error) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await connectDB();
    const { name, email, password, role } = await req.json();
    
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await User.create({ name, email, password: hashedPassword, role, leads: 0, target: 0, achieved: 0 });

    if (redis && redis.status === 'ready') await redis.del(USER_CACHE_KEY);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await connectDB();
    const { rowId, target, leads, achieved } = await req.json(); 
    await User.findByIdAndUpdate(rowId, { leads, target, achieved });
    if (redis && redis.status === 'ready') await redis.del(USER_CACHE_KEY);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Update Failed" }, { status: 500 });
  }
}