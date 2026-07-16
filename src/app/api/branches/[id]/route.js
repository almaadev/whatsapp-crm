import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import Branch from "@/shared/models/Branch";
import { authorizeBranchRequest } from "@/shared/utils/branchAuth";
import { validateBranchInput, isValidObjectId } from "@/shared/utils/branchValidation";

export const dynamic = "force-dynamic";

/**
 * GET /api/branches/:id
 * Retrieve one branch by ID.
 */
export async function GET(req, { params }) {
  try {
    const auth = await authorizeBranchRequest();
    if (auth.error) return auth.error;

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid Branch ID format." },
        { status: 400 }
      );
    }

    await connectDB();

    const branch = await Branch.findById(id).lean();
    if (!branch) {
      return NextResponse.json(
        { success: false, message: "Branch not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      branch: {
        ...branch,
        id: branch._id.toString()
      }
    });

  } catch (error) {
    console.error("GET /api/branches/:id error:", error);
    return NextResponse.json(
      { success: false, message: "An internal server error occurred." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/branches/:id
 * Update an existing branch.
 */
export async function PUT(req, { params }) {
  try {
    const auth = await authorizeBranchRequest();
    if (auth.error) return auth.error;

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid Branch ID format." },
        { status: 400 }
      );
    }

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

    const { isValid, errors, sanitizedData } = validateBranchInput(body, true);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: `Validation failed: ${errors.join(" ")}` },
        { status: 400 }
      );
    }

    // Check if branch exists
    const existingBranch = await Branch.findById(id).lean();
    if (!existingBranch) {
      return NextResponse.json(
        { success: false, message: "Branch not found." },
        { status: 404 }
      );
    }

    // Check for duplicate branch name (excluding this branch)
    if (sanitizedData.name) {
      const duplicate = await Branch.findOne({
        name: { $regex: new RegExp("^" + sanitizedData.name + "$", "i") },
        _id: { $ne: id }
      }).lean();

      if (duplicate) {
        return NextResponse.json(
          { success: false, message: "A branch with this name already exists." },
          { status: 409 }
        );
      }
    }

    const updatedBranch = await Branch.findByIdAndUpdate(
      id,
      { $set: sanitizedData },
      { returnDocument: "after", runValidators: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: "Branch updated successfully.",
      branch: {
        ...updatedBranch,
        id: updatedBranch._id.toString()
      }
    });

  } catch (error) {
    console.error("PUT /api/branches/:id error:", error);
    return NextResponse.json(
      { success: false, message: "An internal server error occurred." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/branches/:id
 * Delete a branch.
 */
export async function DELETE(req, { params }) {
  try {
    const auth = await authorizeBranchRequest();
    if (auth.error) return auth.error;

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid Branch ID format." },
        { status: 400 }
      );
    }

    await connectDB();

    const deletedBranch = await Branch.findByIdAndDelete(id);
    if (!deletedBranch) {
      return NextResponse.json(
        { success: false, message: "Branch not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Branch deleted successfully."
    });

  } catch (error) {
    console.error("DELETE /api/branches/:id error:", error);
    return NextResponse.json(
      { success: false, message: "An internal server error occurred." },
      { status: 500 }
    );
  }
}
