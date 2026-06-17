import { NextResponse } from "next/server";
import { Agent37Error } from "@/lib/agent37";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function apiError(message: string, status = 400, code = "error") {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ApiError || e instanceof Agent37Error) {
    return apiError(e.message, e.status, e.code);
  }
  console.error("[api]", e);
  return apiError("Internal server error", 500, "internal_error");
}
