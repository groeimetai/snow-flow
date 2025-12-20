import { Log } from "./log"

export namespace Retry {
  const log = Log.create({ service: "retry" })

  export interface Options {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number
    /** Initial delay in milliseconds (default: 1000) */
    initialDelay?: number
    /** Maximum delay in milliseconds (default: 30000) */
    maxDelay?: number
    /** Backoff multiplier (default: 2) */
    backoffFactor?: number
    /** Add jitter to prevent thundering herd (default: true) */
    jitter?: boolean
    /** Abort signal for cancellation */
    signal?: AbortSignal
    /** Custom function to determine if error is retryable */
    isRetryable?: (error: unknown) => boolean
    /** Callback on each retry attempt */
    onRetry?: (attempt: number, delay: number, error: unknown) => void
  }

  export interface Result<T> {
    success: boolean
    data?: T
    error?: Error
    attempts: number
  }

  const DEFAULT_OPTIONS: Required<Omit<Options, "signal" | "onRetry" | "isRetryable">> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true,
  }

  /**
   * Determines if an error is a network/connection error that should be retried
   */
  export function isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false

    const message = error.message.toLowerCase()
    const networkErrors = [
      "socket",
      "network",
      "econnreset",
      "econnrefused",
      "etimedout",
      "enotfound",
      "enetunreach",
      "ehostunreach",
      "epipe",
      "connection",
      "fetch failed",
      "abort",
      "timeout",
      "disconnected",
      "closed unexpectedly",
    ]

    return networkErrors.some((err) => message.includes(err))
  }

  /**
   * Determines if an HTTP status code is retryable
   */
  export function isRetryableStatus(status: number): boolean {
    // 429 (Too Many Requests), 500-599 (Server Errors)
    return status === 429 || (status >= 500 && status <= 599)
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  export function calculateDelay(
    attempt: number,
    options: Pick<Options, "initialDelay" | "maxDelay" | "backoffFactor" | "jitter">,
  ): number {
    const { initialDelay = 1000, maxDelay = 30000, backoffFactor = 2, jitter = true } = options

    // Exponential backoff: delay = initialDelay * (backoffFactor ^ attempt)
    let delay = initialDelay * Math.pow(backoffFactor, attempt - 1)

    // Cap at maxDelay
    delay = Math.min(delay, maxDelay)

    // Add jitter (0-25% random variation)
    if (jitter) {
      const jitterAmount = delay * 0.25 * Math.random()
      delay = delay + jitterAmount
    }

    return Math.floor(delay)
  }

  /**
   * Sleep for specified milliseconds with abort support
   */
  export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms)

      if (signal) {
        if (signal.aborted) {
          clearTimeout(timeout)
          reject(new DOMException("Aborted", "AbortError"))
          return
        }

        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout)
            reject(new DOMException("Aborted", "AbortError"))
          },
          { once: true },
        )
      }
    })
  }

  /**
   * Execute a function with retry logic and exponential backoff
   */
  export async function withRetry<T>(
    fn: () => Promise<T>,
    options: Options = {},
  ): Promise<Result<T>> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const isRetryable = opts.isRetryable ?? isNetworkError

    let lastError: Error | undefined
    let attempts = 0

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
      attempts = attempt

      // Check abort signal before each attempt
      if (opts.signal?.aborted) {
        return {
          success: false,
          error: new DOMException("Aborted", "AbortError"),
          attempts,
        }
      }

      try {
        const data = await fn()
        log.debug("operation succeeded", { attempt })
        return { success: true, data, attempts }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry if this was the last attempt
        if (attempt > opts.maxRetries) {
          log.warn("max retries exceeded", {
            attempts: opts.maxRetries,
            error: lastError.message,
          })
          break
        }

        // Don't retry if error is not retryable
        if (!isRetryable(error)) {
          log.debug("error not retryable", {
            attempt,
            error: lastError.message,
          })
          break
        }

        const delay = calculateDelay(attempt, opts)

        log.info("retrying after error", {
          attempt,
          maxRetries: opts.maxRetries,
          delay,
          error: lastError.message,
        })

        // Call onRetry callback if provided
        opts.onRetry?.(attempt, delay, error)

        // Wait before next attempt
        try {
          await sleep(delay, opts.signal)
        } catch (abortError) {
          // Sleep was aborted
          return {
            success: false,
            error: abortError instanceof Error ? abortError : new Error(String(abortError)),
            attempts,
          }
        }
      }
    }

    return {
      success: false,
      error: lastError ?? new Error("Unknown error"),
      attempts,
    }
  }

  /**
   * Create a retryable wrapper around a function
   */
  export function retryable<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: Options = {},
  ): (...args: Parameters<T>) => Promise<Result<Awaited<ReturnType<T>>>> {
    return (...args: Parameters<T>) => withRetry(() => fn(...args), options)
  }

  /**
   * Connection state for tracking reconnection attempts
   */
  export interface ConnectionState {
    name: string
    status: "connected" | "disconnected" | "connecting" | "failed"
    lastConnected?: Date
    lastError?: string
    reconnectAttempts: number
    maxReconnectAttempts: number
  }

  /**
   * Creates a reconnection manager for persistent connections
   */
  export function createReconnectionManager<T>(options: {
    name: string
    connect: () => Promise<T>
    onConnected?: (client: T) => void
    onDisconnected?: (error?: Error) => void
    onReconnecting?: (attempt: number) => void
    maxReconnectAttempts?: number
    reconnectDelay?: number
    maxReconnectDelay?: number
    healthCheckInterval?: number
    healthCheck?: (client: T) => Promise<boolean>
  }) {
    const {
      name,
      connect,
      onConnected,
      onDisconnected,
      onReconnecting,
      maxReconnectAttempts = 5,
      reconnectDelay = 2000,
      maxReconnectDelay = 60000,
      healthCheckInterval = 30000,
      healthCheck,
    } = options

    let client: T | null = null
    let healthCheckTimer: NodeJS.Timeout | null = null
    let reconnecting = false
    let abortController: AbortController | null = null

    const state: ConnectionState = {
      name,
      status: "disconnected",
      reconnectAttempts: 0,
      maxReconnectAttempts,
    }

    const updateState = (update: Partial<ConnectionState>) => {
      Object.assign(state, update)
    }

    const startHealthCheck = () => {
      if (!healthCheck || !healthCheckInterval) return

      stopHealthCheck()

      healthCheckTimer = setInterval(async () => {
        if (!client || state.status !== "connected") return

        try {
          const healthy = await healthCheck(client)
          if (!healthy) {
            log.warn("health check failed", { name })
            handleDisconnect(new Error("Health check failed"))
          }
        } catch (error) {
          log.warn("health check error", {
            name,
            error: error instanceof Error ? error.message : String(error),
          })
          handleDisconnect(error instanceof Error ? error : new Error(String(error)))
        }
      }, healthCheckInterval)
    }

    const stopHealthCheck = () => {
      if (healthCheckTimer) {
        clearInterval(healthCheckTimer)
        healthCheckTimer = null
      }
    }

    const handleDisconnect = async (error?: Error) => {
      if (reconnecting) return

      client = null
      updateState({
        status: "disconnected",
        lastError: error?.message,
      })

      stopHealthCheck()
      onDisconnected?.(error)

      // Attempt reconnection
      await attemptReconnect()
    }

    const attemptReconnect = async () => {
      if (reconnecting) return
      if (state.reconnectAttempts >= maxReconnectAttempts) {
        log.error("max reconnection attempts reached", { name, attempts: state.reconnectAttempts })
        updateState({ status: "failed" })
        return
      }

      reconnecting = true
      abortController = new AbortController()

      const result = await withRetry(connect, {
        maxRetries: maxReconnectAttempts - state.reconnectAttempts,
        initialDelay: reconnectDelay,
        maxDelay: maxReconnectDelay,
        signal: abortController.signal,
        onRetry: (attempt) => {
          updateState({
            status: "connecting",
            reconnectAttempts: state.reconnectAttempts + attempt,
          })
          onReconnecting?.(state.reconnectAttempts + attempt)
        },
      })

      reconnecting = false

      if (result.success && result.data) {
        client = result.data
        updateState({
          status: "connected",
          lastConnected: new Date(),
          reconnectAttempts: 0,
          lastError: undefined,
        })
        startHealthCheck()
        onConnected?.(client)
      } else {
        updateState({
          status: "failed",
          lastError: result.error?.message,
          reconnectAttempts: state.reconnectAttempts + result.attempts,
        })
      }
    }

    return {
      getState: () => ({ ...state }),

      getClient: () => client,

      connect: async (): Promise<T | null> => {
        if (client && state.status === "connected") {
          return client
        }

        updateState({ status: "connecting", reconnectAttempts: 0 })

        const result = await withRetry(connect, {
          maxRetries: maxReconnectAttempts,
          initialDelay: reconnectDelay,
          maxDelay: maxReconnectDelay,
          onRetry: (attempt) => {
            updateState({ reconnectAttempts: attempt })
            onReconnecting?.(attempt)
          },
        })

        if (result.success && result.data) {
          client = result.data
          updateState({
            status: "connected",
            lastConnected: new Date(),
            reconnectAttempts: 0,
          })
          startHealthCheck()
          onConnected?.(client)
          return client
        }

        updateState({
          status: "failed",
          lastError: result.error?.message,
          reconnectAttempts: result.attempts,
        })
        return null
      },

      disconnect: () => {
        if (abortController) {
          abortController.abort()
          abortController = null
        }
        stopHealthCheck()
        client = null
        updateState({
          status: "disconnected",
          reconnectAttempts: 0,
        })
      },

      triggerReconnect: () => {
        if (state.status === "connected") {
          handleDisconnect(new Error("Manual reconnection triggered"))
        } else {
          attemptReconnect()
        }
      },
    }
  }
}
