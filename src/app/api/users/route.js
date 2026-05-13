import { NextResponse } from "next/server";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import redis from "@/lib/redis"; 
import bcrypt from "bcryptjs"; 

const USER_CACHE_KEY = "users:all";

const isAuthorized = (session) => {
    return session?.user?.role === 'superAdmin' || 
           (session?.user?.role === 'sales' && session?.user?.department === 'admin') ||  
           (session?.user?.role === 'doctor' && session?.user?.department === 'admin');
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    if (!isAuthorized(session)) {
        const me = await User.findOne({ email: session.user.email }).lean();
        if (!me) return NextResponse.json([]);
        
        return NextResponse.json([{
            id: me._id.toString(),
            name: me.name,
            email: me.email,
            role: me.role,
            department: me.department,
            branch: me.branch || "",
            target: me.target || 0,
            achieved: me.achieved || 0,
        }]);
    }

    let associates = [];
    if (redis && redis.status === 'ready') {
        const cachedUsers = await redis.get(USER_CACHE_KEY);
        if (cachedUsers) associates = JSON.parse(cachedUsers);
    }

    if (associates.length === 0) {
        const users = await User.find({ role: { $ne: 'superAdmin' } }).lean();

        associates = users.map(u => ({
          id: u._id.toString(), 
          name: u.name,
          preferredName: u.preferredName || "",
          email: u.email,
          number: u.number || "",
          role: u.role,
          department: u.department,
          branch: u.branch || "",
          active: u.active,
          leads: u.leads || 0,
          target: u.target || 0,
          achieved: u.achieved || 0,
        }));

        if (redis && redis.status === 'ready') {
            await redis.set(USER_CACHE_KEY, JSON.stringify(associates), "EX", 3600);
        }
    }

    if (session.user.role === 'superAdmin') {
        return NextResponse.json(associates);
    } else {
        const filteredAssociates = associates.filter(u => u.department !== 'admin');
        return NextResponse.json(filteredAssociates);
    }

  } catch (error) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!isAuthorized(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await connectDB();
    const body = await req.json();
    
    if (session.user.role !== 'superAdmin' && body.department === 'admin') {
        return NextResponse.json({ error: "Only Super Admin can create Admin users" }, { status: 403 });
    }

    const { name, preferredName, email, number, password, role, department, branch, isAdmin, active, accessModules } = body;
    
    if (!branch) return NextResponse.json({ error: "Branch is mandatory" }, { status: 400 });

    const salt = await bcrypt.genSalt(Number(process.env.SALT || 10));
    const hashedPassword = await bcrypt.hash(password, salt);
    
    await User.create({ 
        name, 
        preferredName: preferredName || undefined, 
        email, 
        number: number || undefined,
        password: hashedPassword, 
        role, 
        department, 
        branch,
        isAdmin, 
        active, 
        accessModules,
        leads: 0, target: 0, achieved: 0 
    });

    if (redis && redis.status === 'ready') await redis.del(USER_CACHE_KEY);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!isAuthorized(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

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

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!isAuthorized(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: "User ID missing" }, { status: 400 });

    await User.findByIdAndDelete(id);
    if (redis && redis.status === 'ready') await redis.del(USER_CACHE_KEY);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Deletion Failed" }, { status: 500 });
  }
}