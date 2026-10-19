import { NextResponse } from "next/server";
import { getRoomService } from "@/modules/room/service-singleton";
import { errorResponse } from "@/lib/api-error";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const room = await getRoomService().getSnapshot(code);
    return NextResponse.json({ room });
  } catch (error) {
    return errorResponse(error);
  }
}
