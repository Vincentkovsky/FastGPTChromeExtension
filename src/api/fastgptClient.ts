import { FastGPTConfig, ChatMessage } from "../types/storage";

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  details?: string;
}

export interface FastGPTApiError {
  code?: number;
  message: string;
  type: "network" | "authentication" | "validation" | "server" | "unknown";
  retryable?: boolean;
  retryAfter?: number; // seconds to wait before retry
}

// OpenAI-compatible request/response types for FastGPT
export interface ChatCompletionMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCompletionRequest {
  chatId?: string;
  stream: boolean;
  detail: boolean;
  messages: ChatCompletionMessage[];
  variables?: Record<string, any>;
  responseChatItemId?: string;
}

export interface ChatCompletionChoice {
  message: {
    role: "assistant";
    content: string;
  };
  finish_reason: string;
  index: number;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: ChatCompletionChoice[];
}

export interface ChatCompletionStreamChoice {
  delta: {
    role?: "assistant";
    content?: string;
  };
  finish_reason: string | null;
  index: number;
}

export interface ChatCompletionStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionStreamChoice[];
}

export interface StreamingError {
  type: "connection" | "parsing" | "timeout" | "abort";
  message: string;
  recoverable: boolean;
}

export interface StreamingEvent {
  type: "start" | "chunk" | "error" | "complete" | "abort";
  data?: string;
  error?: StreamingError;
  metadata?: {
    messageId?: string;
    totalChunks?: number;
    currentChunk?: number;
  };
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

export class FastGPTClient {
  private config: FastGPTConfig;
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
  };

  constructor(config: FastGPTConfig) {
    this.config = config;
  }

  /**
   * Test connection to FastGPT API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Validate configuration first
      const validationError = this.validateConfig();
      if (validationError) {
        return {
          success: false,
          error: validationError.message,
          details: "Configuration validation failed",
        };
      }

      // Make a simple test request to the chat completions endpoint
      const response = await this.makeTestRequest();

      if (response.success) {
        return {
          success: true,
          details: "Connection test successful",
        };
      } else {
        return {
          success: false,
          error: response.error?.message || "Connection test failed",
          details: response.error?.type || "Unknown error",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "Unexpected error during connection test",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Validate the FastGPT configuration
   */
  private validateConfig(): FastGPTApiError | null {
    if (!this.config.baseUrl) {
      return {
        message: "Base URL is required",
        type: "validation",
      };
    }

    if (!this.config.appId) {
      return {
        message: "App ID is required",
        type: "validation",
      };
    }

    if (!this.config.apiKey) {
      return {
        message: "API Key is required",
        type: "validation",
      };
    }

    // Validate URL format
    try {
      const url = new URL(this.config.baseUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        return {
          message: "Base URL must use HTTP or HTTPS protocol",
          type: "validation",
        };
      }
    } catch {
      return {
        message: "Invalid Base URL format",
        type: "validation",
      };
    }

    return null;
  }

  /**
   * Make a test request to FastGPT API
   */
  private async makeTestRequest(): Promise<{
    success: boolean;
    error?: FastGPTApiError;
  }> {
    try {
      return await this.executeWithRetry(async () => {
        // Construct the API endpoint URL
        const apiUrl = this.buildApiUrl("/v1/chat/completions");

        // Prepare test request payload
        const requestBody = {
          chatId: `test_${Date.now()}`,
          stream: false,
          detail: false,
          messages: [
            {
              role: "user",
              content: "test connection",
            },
          ],
        };

        // Make the request
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        // Handle different response statuses
        if (response.ok) {
          // Connection successful
          return { success: true };
        } else {
          // Parse error response
          const errorData = await this.parseErrorResponse(response);

          // Throw error to trigger retry logic if retryable
          if (errorData.retryable) {
            throw new Error(errorData.message);
          }

          return {
            success: false,
            error: errorData,
          };
        }
      });
    } catch (error) {
      // Handle network errors and other exceptions
      if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
          success: false,
          error: {
            message: "Network error: Unable to connect to FastGPT server",
            type: "network",
            retryable: true,
          },
        };
      }

      return {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "Unknown network error",
          type: "network",
          retryable: true,
        },
      };
    }
  }

  /**
   * Build API URL from base URL and endpoint
   */
  private buildApiUrl(endpoint: string): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    const apiPath = baseUrl.includes("/api") ? "" : "/api";
    return `${baseUrl}${apiPath}${endpoint}`;
  }

  /**
   * Parse error response from FastGPT API
   */
  private async parseErrorResponse(
    response: Response
  ): Promise<FastGPTApiError> {
    try {
      const errorData = await response.json();
      const retryAfter = response.headers.get("Retry-After");

      // Handle different HTTP status codes
      switch (response.status) {
        case 401:
          return {
            code: 401,
            message: "Authentication failed: Invalid API key",
            type: "authentication",
            retryable: false,
          };

        case 403:
          return {
            code: 403,
            message: "Access forbidden: Check your API key permissions",
            type: "authentication",
            retryable: false,
          };

        case 404:
          return {
            code: 404,
            message: "API endpoint not found: Check your Base URL",
            type: "validation",
            retryable: false,
          };

        case 400:
          return {
            code: 400,
            message: errorData.message || "Bad request: Invalid configuration",
            type: "validation",
            retryable: false,
          };

        case 429:
          return {
            code: 429,
            message: "Rate limit exceeded: Too many requests",
            type: "server",
            retryable: true,
            retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
          };

        case 500:
        case 502:
        case 503:
        case 504:
          return {
            code: response.status,
            message: "Server error: FastGPT service is temporarily unavailable",
            type: "server",
            retryable: true,
            retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
          };

        case 408: // Request Timeout
          return {
            code: 408,
            message: "Request timeout: The server took too long to respond",
            type: "server",
            retryable: true,
          };

        default:
          return {
            code: response.status,
            message:
              errorData.message ||
              `HTTP ${response.status}: ${response.statusText}`,
            type: "unknown",
            retryable: response.status >= 500, // Retry server errors by default
          };
      }
    } catch {
      // If we can't parse the error response, return a generic error
      return {
        code: response.status,
        message: `HTTP ${response.status}: ${response.statusText}`,
        type: "unknown",
        retryable: response.status >= 500,
      };
    }
  }

  /**
   * Execute a request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryOptions: Partial<RetryOptions> = {}
  ): Promise<T> {
    const options = { ...this.defaultRetryOptions, ...retryOptions };
    let lastError: Error;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt === options.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateRetryDelay(attempt, options, error);

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    // Network errors are always retryable
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }

    // Check if it's a FastGPT API error with retryable flag
    if (
      error instanceof Error &&
      error.message.includes("Rate limit exceeded")
    ) {
      return true;
    }

    if (error instanceof Error && error.message.includes("Server error")) {
      return true;
    }

    if (error instanceof Error && error.message.includes("Request timeout")) {
      return true;
    }

    if (error instanceof Error && error.message.includes("Network error")) {
      return true;
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    attempt: number,
    options: RetryOptions,
    error: unknown
  ): number {
    // Check if server provided a Retry-After header value
    if (
      error instanceof Error &&
      error.message.includes("Rate limit exceeded")
    ) {
      // For rate limiting, use a longer base delay
      const rateLimitDelay = Math.min(
        options.baseDelay * Math.pow(options.backoffMultiplier, attempt + 1),
        options.maxDelay
      );
      return rateLimitDelay;
    }

    // Standard exponential backoff
    const delay = Math.min(
      options.baseDelay * Math.pow(options.backoffMultiplier, attempt),
      options.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send a chat message and get streaming response
   * This is the primary method for chat interactions as per requirements (streaming only)
   */
  async *sendMessageStream(
    message: string,
    chatId?: string,
    variables?: Record<string, any>
  ): AsyncGenerator<string, void, unknown> {
    // Validate configuration
    const validationError = this.validateConfig();
    if (validationError) {
      throw new Error(validationError.message);
    }

    // For streaming, we need to handle retries at the request level, not the stream level
    const streamGenerator = await this.executeWithRetry(async () => {
      return this.createStreamGenerator(message, chatId, variables);
    });

    yield* streamGenerator;
  }

  /**
   * Send a chat message and get enhanced streaming response with events
   * Provides better real-time message display support and error handling
   */
  async *sendMessageStreamWithEvents(
    message: string,
    chatId?: string,
    variables?: Record<string, any>,
    options?: {
      timeout?: number; // milliseconds
      abortSignal?: AbortSignal;
    }
  ): AsyncGenerator<StreamingEvent, void, unknown> {
    // Validate configuration
    const validationError = this.validateConfig();
    if (validationError) {
      yield {
        type: "error",
        error: {
          type: "connection",
          message: validationError.message,
          recoverable: false,
        },
      };
      return;
    }

    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    let chunkCount = 0;

    try {
      // Emit start event
      yield {
        type: "start",
        metadata: {
          messageId,
          totalChunks: 0,
          currentChunk: 0,
        },
      };

      // Create streaming generator with enhanced error handling
      const streamGenerator = await this.executeWithRetry(async () => {
        return this.createEnhancedStreamGenerator(
          message,
          chatId,
          variables,
          options
        );
      });

      // Process stream with event emission
      for await (const chunk of streamGenerator) {
        chunkCount++;
        yield {
          type: "chunk",
          data: chunk,
          metadata: {
            messageId,
            currentChunk: chunkCount,
          },
        };
      }

      // Emit completion event
      yield {
        type: "complete",
        metadata: {
          messageId,
          totalChunks: chunkCount,
          currentChunk: chunkCount,
        },
      };
    } catch (error) {
      // Determine error type and recoverability
      const streamingError = this.classifyStreamingError(error);

      yield {
        type: "error",
        error: streamingError,
        metadata: {
          messageId,
          currentChunk: chunkCount,
        },
      };
    }
  }

  /**
   * Create an enhanced streaming generator with better error handling and timeout support
   */
  private async createEnhancedStreamGenerator(
    message: string,
    chatId?: string,
    variables?: Record<string, any>,
    options?: {
      timeout?: number;
      abortSignal?: AbortSignal;
    }
  ): Promise<AsyncGenerator<string, void, unknown>> {
    const apiUrl = this.buildApiUrl("/v1/chat/completions");

    const requestBody: ChatCompletionRequest = {
      chatId,
      stream: true,
      detail: false,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
      variables,
    };

    // Create AbortController for timeout and cancellation
    const controller = new AbortController();
    const timeoutId = options?.timeout
      ? setTimeout(() => {
          controller.abort();
        }, options.timeout)
      : null;

    // Listen for external abort signal
    if (options?.abortSignal) {
      options.abortSignal.addEventListener("abort", () => {
        controller.abort();
      });
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);

        // Throw error to trigger retry logic if retryable
        if (error.retryable) {
          throw new Error(error.message);
        }

        // For non-retryable errors, throw immediately
        throw new Error(error.message);
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      return this.processEnhancedStreamResponse(
        response.body,
        controller.signal
      );
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Handle abort errors
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request was aborted");
      }

      throw error;
    }
  }

  /**
   * Create a streaming generator for chat messages
   */
  private async createStreamGenerator(
    message: string,
    chatId?: string,
    variables?: Record<string, any>
  ): Promise<AsyncGenerator<string, void, unknown>> {
    const apiUrl = this.buildApiUrl("/v1/chat/completions");

    const requestBody: ChatCompletionRequest = {
      chatId,
      stream: true,
      detail: false,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
      variables,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await this.parseErrorResponse(response);

      // Throw error to trigger retry logic if retryable
      if (error.retryable) {
        throw new Error(error.message);
      }

      // For non-retryable errors, throw immediately
      throw new Error(error.message);
    }

    if (!response.body) {
      throw new Error("No response body received");
    }

    return this.processStreamResponse(response.body);
  }

  /**
   * Process enhanced streaming response body with better error handling
   */
  private async *processEnhancedStreamResponse(
    body: ReadableStream<Uint8Array>,
    abortSignal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        // Check for abort signal
        if (abortSignal?.aborted) {
          throw new Error("Stream was aborted");
        }

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines from buffer
        const lines = buffer.split("\n");
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (trimmedLine === "" || trimmedLine === "data: [DONE]") {
            continue;
          }

          if (trimmedLine.startsWith("data: ")) {
            try {
              const jsonStr = trimmedLine.slice(6); // Remove 'data: ' prefix
              const data: ChatCompletionStreamResponse = JSON.parse(jsonStr);

              if (
                data.choices &&
                data.choices[0] &&
                data.choices[0].delta.content
              ) {
                yield data.choices[0].delta.content;
              }
            } catch (parseError) {
              // Log parsing errors but continue processing
              console.warn("Failed to parse streaming chunk:", parseError);
              continue;
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const trimmedLine = buffer.trim();
        if (
          trimmedLine.startsWith("data: ") &&
          trimmedLine !== "data: [DONE]"
        ) {
          try {
            const jsonStr = trimmedLine.slice(6);
            const data: ChatCompletionStreamResponse = JSON.parse(jsonStr);

            if (
              data.choices &&
              data.choices[0] &&
              data.choices[0].delta.content
            ) {
              yield data.choices[0].delta.content;
            }
          } catch (parseError) {
            console.warn("Failed to parse final streaming chunk:", parseError);
          }
        }
      }
    } catch (error) {
      // Handle stream reading errors
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Stream was aborted");
      }

      if (error instanceof Error && error.message.includes("network")) {
        throw new Error("Network connection lost during streaming");
      }

      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Process streaming response body
   */
  private async *processStreamResponse(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<string, void, unknown> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    try {
      console.log("Starting to process stream response");
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("Stream reading completed");
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log("Received chunk:", chunk);
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmedLine = line.trim();
          console.log("Processing line:", trimmedLine);

          if (trimmedLine === "" || trimmedLine === "data: [DONE]") {
            continue;
          }

          if (trimmedLine.startsWith("data: ")) {
            try {
              const jsonStr = trimmedLine.slice(6); // Remove 'data: ' prefix
              console.log("Parsing JSON:", jsonStr);
              const data = JSON.parse(jsonStr);
              console.log("Parsed data:", data);

              // Check if this is an error response
              if (data.code && data.statusText && data.message) {
                // This is an error response from FastGPT - show detailed error info
                let errorMessage = `❌ FastGPT API 错误\n\n`;
                errorMessage += `• 错误代码: ${data.code}\n`;
                errorMessage += `• 状态: ${data.statusText}\n`;
                errorMessage += `• 消息: ${data.message}`;

                if (data.data) {
                  errorMessage += `\n• 详细信息: ${JSON.stringify(data.data)}`;
                }

                // Add user-friendly translation for common errors
                if (data.statusText === "aiPointsNotEnough") {
                  errorMessage += `\n\n💡 这通常表示您的 FastGPT 账户余额不足，请前往 FastGPT 平台充值。`;
                } else if (data.statusText === "authenticationFailed") {
                  errorMessage += `\n\n💡 请检查您的 API 密钥是否正确配置。`;
                } else if (data.statusText === "rateLimitExceeded") {
                  errorMessage += `\n\n💡 请求过于频繁，请稍后再试。`;
                }

                throw new Error(errorMessage);
              }

              // Check if this is a normal streaming response
              if (
                data.choices &&
                data.choices[0] &&
                data.choices[0].delta &&
                data.choices[0].delta.content
              ) {
                console.log("Yielding content:", data.choices[0].delta.content);
                yield data.choices[0].delta.content;
              }
            } catch (parseError) {
              console.error(
                "JSON parse error:",
                parseError,
                "for line:",
                trimmedLine
              );
              // If it's an error we threw, re-throw it
              if (
                parseError instanceof Error &&
                parseError.message.startsWith("❌")
              ) {
                throw parseError;
              }
              // Skip malformed JSON chunks
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Send a chat message and get complete response (non-streaming)
   * Provided for compatibility, but streaming is preferred per requirements
   */
  async sendMessage(
    message: string,
    chatId?: string,
    variables?: Record<string, any>
  ): Promise<string> {
    // Validate configuration
    const validationError = this.validateConfig();
    if (validationError) {
      throw new Error(validationError.message);
    }

    return await this.executeWithRetry(async () => {
      const apiUrl = this.buildApiUrl("/v1/chat/completions");

      const requestBody: ChatCompletionRequest = {
        chatId,
        stream: false,
        detail: false,
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
        variables,
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);

        // Throw error to trigger retry logic if retryable
        if (error.retryable) {
          throw new Error(error.message);
        }

        // For non-retryable errors, throw immediately
        throw new Error(error.message);
      }

      const data: ChatCompletionResponse = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }

      throw new Error("Invalid response format from FastGPT API");
    });
  }

  /**
   * Send a chat message with conversation history
   */
  async sendMessageWithHistory(
    messages: ChatMessage[],
    chatId?: string,
    variables?: Record<string, any>
  ): Promise<string> {
    // Validate configuration
    const validationError = this.validateConfig();
    if (validationError) {
      throw new Error(validationError.message);
    }

    return await this.executeWithRetry(async () => {
      const apiUrl = this.buildApiUrl("/v1/chat/completions");

      // Convert ChatMessage[] to ChatCompletionMessage[]
      const apiMessages: ChatCompletionMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const requestBody: ChatCompletionRequest = {
        chatId,
        stream: false,
        detail: false,
        messages: apiMessages,
        variables,
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);

        // Throw error to trigger retry logic if retryable
        if (error.retryable) {
          throw new Error(error.message);
        }

        // For non-retryable errors, throw immediately
        throw new Error(error.message);
      }

      const data: ChatCompletionResponse = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }

      throw new Error("Invalid response format from FastGPT API");
    });
  }

  /**
   * Send a chat message with conversation history and get streaming response
   */
  async *sendMessageWithHistoryStream(
    messages: ChatMessage[],
    chatId?: string,
    variables?: Record<string, any>
  ): AsyncGenerator<string, void, unknown> {
    // Validate configuration
    const validationError = this.validateConfig();
    if (validationError) {
      throw new Error(validationError.message);
    }

    // For streaming, we need to handle retries at the request level, not the stream level
    const streamGenerator = await this.executeWithRetry(async () => {
      return this.createStreamGeneratorWithHistory(messages, chatId, variables);
    });

    yield* streamGenerator;
  }

  /**
   * Create a streaming generator for chat messages with history
   */
  private async createStreamGeneratorWithHistory(
    messages: ChatMessage[],
    chatId?: string,
    variables?: Record<string, any>
  ): Promise<AsyncGenerator<string, void, unknown>> {
    const apiUrl = this.buildApiUrl("/v1/chat/completions");

    // Convert ChatMessage[] to ChatCompletionMessage[]
    const apiMessages: ChatCompletionMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const requestBody: ChatCompletionRequest = {
      chatId,
      stream: true,
      detail: false,
      messages: apiMessages,
      variables,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await this.parseErrorResponse(response);

      // Throw error to trigger retry logic if retryable
      if (error.retryable) {
        throw new Error(error.message);
      }

      // For non-retryable errors, throw immediately
      throw new Error(error.message);
    }

    if (!response.body) {
      throw new Error("No response body received");
    }

    return this.processStreamResponse(response.body);
  }

  /**
   * Classify streaming errors for better error handling and recovery
   */
  private classifyStreamingError(error: unknown): StreamingError {
    if (error instanceof Error) {
      // Handle abort errors
      if (error.name === "AbortError" || error.message.includes("aborted")) {
        return {
          type: "abort",
          message: "Request was cancelled or timed out",
          recoverable: true,
        };
      }

      // Handle timeout errors
      if (error.message.includes("timeout")) {
        return {
          type: "timeout",
          message: "Request timed out while streaming",
          recoverable: true,
        };
      }

      // Handle network connection errors
      if (
        error.message.includes("network") ||
        error.message.includes("fetch") ||
        error.message.includes("connection lost")
      ) {
        return {
          type: "connection",
          message: "Network connection lost during streaming",
          recoverable: true,
        };
      }

      // Handle parsing errors
      if (error.message.includes("parse") || error.message.includes("JSON")) {
        return {
          type: "parsing",
          message: "Failed to parse streaming response",
          recoverable: false,
        };
      }

      // Handle authentication and validation errors (non-recoverable)
      if (
        error.message.includes("Authentication failed") ||
        error.message.includes("Invalid API key") ||
        error.message.includes("Access forbidden")
      ) {
        return {
          type: "connection",
          message: error.message,
          recoverable: false,
        };
      }

      // Handle server errors (potentially recoverable)
      if (
        error.message.includes("Server error") ||
        error.message.includes("service unavailable")
      ) {
        return {
          type: "connection",
          message: error.message,
          recoverable: true,
        };
      }

      // Generic error handling
      return {
        type: "connection",
        message: error.message,
        recoverable: true,
      };
    }

    // Unknown error type
    return {
      type: "connection",
      message: "An unknown error occurred during streaming",
      recoverable: false,
    };
  }

  /**
   * Send a chat message with conversation history and get enhanced streaming response with events
   */
  async *sendMessageWithHistoryStreamWithEvents(
    messages: ChatMessage[],
    chatId?: string,
    variables?: Record<string, any>,
    options?: {
      timeout?: number;
      abortSignal?: AbortSignal;
    }
  ): AsyncGenerator<StreamingEvent, void, unknown> {
    // Validate configuration
    const validationError = this.validateConfig();
    if (validationError) {
      yield {
        type: "error",
        error: {
          type: "connection",
          message: validationError.message,
          recoverable: false,
        },
      };
      return;
    }

    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    let chunkCount = 0;

    try {
      // Emit start event
      yield {
        type: "start",
        metadata: {
          messageId,
          totalChunks: 0,
          currentChunk: 0,
        },
      };

      // Create streaming generator with enhanced error handling
      const streamGenerator = await this.executeWithRetry(async () => {
        return this.createEnhancedStreamGeneratorWithHistory(
          messages,
          chatId,
          variables,
          options
        );
      });

      // Process stream with event emission
      for await (const chunk of streamGenerator) {
        chunkCount++;
        yield {
          type: "chunk",
          data: chunk,
          metadata: {
            messageId,
            currentChunk: chunkCount,
          },
        };
      }

      // Emit completion event
      yield {
        type: "complete",
        metadata: {
          messageId,
          totalChunks: chunkCount,
          currentChunk: chunkCount,
        },
      };
    } catch (error) {
      // Determine error type and recoverability
      const streamingError = this.classifyStreamingError(error);

      yield {
        type: "error",
        error: streamingError,
        metadata: {
          messageId,
          currentChunk: chunkCount,
        },
      };
    }
  }

  /**
   * Create an enhanced streaming generator for chat messages with history
   */
  private async createEnhancedStreamGeneratorWithHistory(
    messages: ChatMessage[],
    chatId?: string,
    variables?: Record<string, any>,
    options?: {
      timeout?: number;
      abortSignal?: AbortSignal;
    }
  ): Promise<AsyncGenerator<string, void, unknown>> {
    const apiUrl = this.buildApiUrl("/v1/chat/completions");

    // Convert ChatMessage[] to ChatCompletionMessage[]
    const apiMessages: ChatCompletionMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const requestBody: ChatCompletionRequest = {
      chatId,
      stream: true,
      detail: false,
      messages: apiMessages,
      variables,
    };

    // Create AbortController for timeout and cancellation
    const controller = new AbortController();
    const timeoutId = options?.timeout
      ? setTimeout(() => {
          controller.abort();
        }, options.timeout)
      : null;

    // Listen for external abort signal
    if (options?.abortSignal) {
      options.abortSignal.addEventListener("abort", () => {
        controller.abort();
      });
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);

        // Throw error to trigger retry logic if retryable
        if (error.retryable) {
          throw new Error(error.message);
        }

        // For non-retryable errors, throw immediately
        throw new Error(error.message);
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      return this.processEnhancedStreamResponse(
        response.body,
        controller.signal
      );
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Handle abort errors
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request was aborted");
      }

      throw error;
    }
  }

  /**
   * Get user-friendly error message for different error types
   */
  static getErrorMessage(error: FastGPTApiError): string {
    switch (error.type) {
      case "network":
        return "Unable to connect to FastGPT server. Please check your internet connection and Base URL.";

      case "authentication":
        return "Authentication failed. Please check your API key and ensure it has the correct permissions.";

      case "validation":
        return "Configuration error. Please verify your Base URL, App ID, and API key are correct.";

      case "server":
        return "FastGPT server is temporarily unavailable. Please try again later.";

      default:
        return (
          error.message ||
          "An unexpected error occurred during connection test."
        );
    }
  }
}
