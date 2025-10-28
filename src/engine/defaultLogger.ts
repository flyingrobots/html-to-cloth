import type { EngineLogger } from './types'

/**
 * Shared default logger for engine systems. Delegates to console.
 * Consumers can inject a custom logger into EngineWorld to redirect output elsewhere.
 */
export const DEFAULT_LOGGER: EngineLogger = {
  error: (...args: unknown[]) => console.error(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  info: (...args: unknown[]) => console.info(...args),
}

