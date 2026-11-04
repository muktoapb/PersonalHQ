// Shared result shape for core logic, used by server actions and MCP tools.
export type Fail = { ok: false; error: string };
export type Result<T = object> = ({ ok: true } & T) | Fail;

export const fail = (error: string): Fail => ({ ok: false, error });
