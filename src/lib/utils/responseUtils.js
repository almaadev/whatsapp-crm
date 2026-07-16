import { NextResponse } from "next/server";

export function success(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function validationError(message) {
  return NextResponse.json({ error: `Validation Error: ${message}` }, { status: 400 });
}
