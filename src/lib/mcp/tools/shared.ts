import "server-only";
import { z } from "zod";
import type { Result } from "@/lib/core/result";

// An MCP tool: zod input (also published as its JSON Schema), and a handler
// that returns data or a core Result. `write` tools refresh the web UI.
export type Tool = {
  name: string;
  description: string;
  input: z.ZodObject;
  write?: boolean;
  run: (args: never) => Promise<unknown>;
};

export const tool = <S extends z.ZodObject>(t: { name: string; description: string; input: S; write?: boolean; run: (args: z.infer<S>) => Promise<unknown> }): Tool => t as Tool;

export const id = (what: string) => z.string().describe(`${what} id`);
export const date = z.iso.date().describe("YYYY-MM-DD");

// Core functions return Result; anything else is plain data.
export const isFail = (r: unknown): r is Extract<Result, { ok: false }> =>
  !!r && typeof r === "object" && (r as { ok?: unknown }).ok === false;
