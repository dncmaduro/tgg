import { z } from "zod";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { getRoomService } from "@/modules/room/service-singleton";
import { identitySchema } from "@/modules/realtime/protocol";

export const runtime = "nodejs";

const actionSchema = z.object({ type: z.string().min(1).max(40), payload: z.unknown() });
const mutationSchema = z.object({
  intent: z.enum(["join", "ready", "start", "action", "restart", "leave"]),
  identity: identitySchema,
  ready: z.boolean().optional(),
  action: actionSchema.optional(),
});

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = mutationSchema.parse(await request.json());
    const service = getRoomService();
    if (body.intent === "join") return NextResponse.json({ room: await service.joinRoom(code, body.identity) });
    if (body.intent === "ready") return NextResponse.json({ room: await service.setReady(code, body.identity, body.ready ?? true) });
    if (body.intent === "start") return NextResponse.json({ room: await service.startGame(code, body.identity) });
    if (body.intent === "restart") return NextResponse.json({ room: await service.restartGame(code, body.identity) });
    if (body.intent === "leave") return NextResponse.json({ room: await service.leaveRoom(code, body.identity) });
    if (!body.action) throw new Error("Missing action");
    return NextResponse.json({ room: await service.applyAction(code, body.identity, body.action) });
  } catch (error) {
    return errorResponse(error);
  }
}
