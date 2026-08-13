import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { GeneratedStep, Step } from "@/lib/types";

export function toSteps(generated: GeneratedStep[]): Step[] {
  return generated.map((g, i) => ({
    id: nanoid(8),
    order: i,
    status: "generated" as const,
    ...g,
  }));
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Malformed ids should 404, not crash the route with a mongoose CastError. */
export function isValidObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}
