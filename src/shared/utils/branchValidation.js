import mongoose from "mongoose";

export function sanitizeString(val) {
  if (typeof val !== "string") return "";
  return val.trim().replace(/<\/?[^>]+(>|$)/g, "");
}

export function validateBranchInput(body, isUpdate = false) {
  const fields = ["name", "address", "phone", "email", "manager"];
  const errors = [];
  const sanitizedData = {};

  // For updates, we also allow status
  if (isUpdate) {
    if (body.status !== undefined) {
      if (typeof body.status !== "string") {
        errors.push("Status must be a string.");
      } else {
        const cleanStatus = sanitizeString(body.status);
        if (cleanStatus !== "active" && cleanStatus !== "inactive") {
          errors.push("Status must be either 'active' or 'inactive'.");
        } else {
          sanitizedData.status = cleanStatus;
        }
      }
    }
  }

  for (const field of fields) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "string") {
        errors.push(`${field} must be a string.`);
        continue;
      }
      const cleanVal = sanitizeString(body[field]);
      if (cleanVal === "") {
        if (field === "email" || field === "manager") {
          sanitizedData[field] = "";
          continue;
        }
        errors.push(`${field} cannot be empty.`);
        continue;
      }
      
      if (field === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanVal)) {
          errors.push("Invalid email format.");
        }
      }

      if (field === "phone") {
        const phoneRegex = /^\+?[0-9]{10,15}$/;
        if (!phoneRegex.test(cleanVal)) {
          errors.push("Phone must be between 10 and 15 digits, and contain only numbers (optionally starting with +).");
        }
      }

      sanitizedData[field] = cleanVal;
    } else if (!isUpdate) {
      if (field !== "email" && field !== "manager") {
        errors.push(`${field} is required.`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData,
  };
}

export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}
