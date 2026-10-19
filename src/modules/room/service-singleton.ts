import { getRoomStore } from "@/modules/room/store-factory";
import { RoomService } from "@/modules/room/room-service";

let service: RoomService | undefined;

export function getRoomService(): RoomService {
  if (!service) service = new RoomService(getRoomStore());
  return service;
}

export function resetRoomServiceForTests(): void {
  service = undefined;
}
