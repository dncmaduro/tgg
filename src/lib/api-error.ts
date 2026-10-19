import { z } from "zod";
import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";

export function errorResponse(error: unknown): NextResponse {
  if (isAppError(error)) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Dữ liệu gửi lên không hợp lệ." } }, { status: 400 });
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Đã có lỗi xảy ra." } }, { status: 500 });
}
