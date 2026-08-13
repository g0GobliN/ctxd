export const logger = {
  debug: (msg: string, fields?: unknown) => emit("debug", msg, fields),
  info: (msg: string, fields?: unknown) => emit("info", msg, fields),
  error: (msg: string, fields?: unknown) => emit("error", msg, fields),
};

function emit(level: string, msg: string, fields?: unknown): void {
  process.stdout.write(`${JSON.stringify({ level, msg, fields })}\n`);
}
