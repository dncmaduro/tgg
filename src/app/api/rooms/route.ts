import { z } from "zod";
import { NextResponse } from "next/server";
import { getRoomService } from "@/modules/room/service-singleton";
import { identitySchema } from "@/modules/realtime/protocol";
import { errorResponse } from "@/lib/api-error";
import { enforceRateLimit, getRequestAddress } from "@/lib/rate-limit";

export const runtime = "nodejs";

const createRoomSchema = z.object({ gameId: z.string(), identity: identitySchema });

export async function POST(request: Request) {
  try {
    enforceRateLimit("create-room", getRequestAddress(request), 10, 60_000);
    const body = createRoomSchema.parse(await request.json());
    const room = await getRoomService().createRoom(body.gameId, body.identity);
    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
