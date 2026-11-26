/// <reference types="vite/client" />

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: Record<string, unknown> & { frame: number; state: string };
  __TD__?: Record<string, (...args: never[]) => unknown>;
}
