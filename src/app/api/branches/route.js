import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import Branch from "@/shared/models/Branch";
import { authorizeBranchRequest } from "@/shared/utils/branchAuth";
import { validateBranchInput } from "@/shared/utils/branchValidation";

export const dynamic = "force-dynamic";

/**
 * GET /api/branches
 * Retrieve all branches with search, status filtering, and pagination.
 */
export async function GET(req) {
  try {
    const auth = await authorizeBranchRequest();
    if (auth.error) return auth.error;

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { name: searchRegex },
        { manager: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ];
    }

    const total = await Branch.countDocuments(query);
    const activeCount = await Branch.countDocuments({ status: "active" });
    const inactiveCount = await Branch.countDocuments({ status: "inactive" });
    const pages = Math.ceil(total / limit) || 1;
    const branches = await Branch.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      branches: branches.map(b => ({
        ...b,
        id: b._id.toString()
      })),
      pagination: {
        page,
        limit,
        total,
        pages
      },
      stats: {
        total: activeCount + inactiveCount,
        active: activeCount,
        inactive: inactiveCount
      }
    });

  } catch (error) {
    console.error("GET /api/branches error:", error);
    return NextResponse.json(
      { success: false, message: "An internal server error occurred." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/branches
 * Create a new branch.
 */
export async function POST(req) {
  try {
    const auth = await authorizeBranchRequest();
    if (auth.error) return auth.error;

    await connectDB();

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { isValid, errors, sanitizedData } = validateBranchInput(body, false);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: `Validation failed: ${errors.join(" ")}` },
        { status: 400 }
      );
    }

    // Check for duplicate branch name (case-insensitive)
    const duplicate = await Branch.findOne({
      name: { $regex: new RegExp("^" + sanitizedData.name + "$", "i") }
    }).lean();

    if (duplicate) {
      return NextResponse.json(
        { success: false, message: "A branch with this name already exists." },
        { status: 409 }
      );
    }

    const newBranch = await Branch.create({
      ...sanitizedData,
      status: "active" // Default status on creation
    });

    return NextResponse.json(
      {
        success: true,
        message: "Branch created successfully.",
        branch: {
          ...newBranch.toObject(),
          id: newBranch._id.toString()
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("POST /api/branches error:", error);
    return NextResponse.json(
      { success: false, message: "An internal server error occurred." },
      { status: 500 }
    );
  }
}
