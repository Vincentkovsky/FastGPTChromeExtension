import { FastGPTClient, ConnectionTestResult, FastGPTApiError, ChatCompletionResponse, ChatCompletionStreamResponse, RetryOptions } from '../fastgptClient';
import { FastGPTConfig, ChatMessage } from '../../types/storage';

// Mock fetch globally
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('FastGPTClient', () => {
  let client: FastGPTClient;
  let mockConfig: FastGPTConfig;

  beforeEach(() => {
    mockFetch.mockClear();
    
    mockConfig = {
      baseUrl: 'https://fastgpt.io',
      appId: 'test-app-123',
      apiKey: 'sk-test-api-key-12345'
    };
    
    client = new FastGPTClient(mockConfig);
  });

  describe('Configuration Validation', () => {
    test('should validate complete configuration', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test', choices: [{ message: { content: 'test' } }] })
      });

      const result = await client.testConnection();
      expect(result.success).toBe(true);
    });

    test('should reject missing base URL', async () => {
      const invalidConfig = { ...mockConfig, baseUrl: '' };
      const invalidClient = new FastGPTClient(invalidConfig);

      const result = await invalidClient.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Base URL is required');
      expect(result.details).toBe('Configuration validation failed');
    });

    test('should reject missing app ID', async () => {
      const invalidConfig = { ...mockConfig, appId: '' };
      const invalidClient = new FastGPTClient(invalidConfig);

      const result = await invalidClient.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('App ID is required');
    });

    test('should reject missing API key', async () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };
      const invalidClient = new FastGPTClient(invalidConfig);

      const result = await invalidClient.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('API Key is required');
    });

    test('should reject invalid URL format', async () => {
      const invalidConfig = { ...mockConfig, baseUrl: 'not-a-url' };
      const invalidClient = new FastGPTClient(invalidConfig);

      const result = await invalidClient.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Base URL format');
    });

    test('should reject non-HTTP/HTTPS protocols', async () => {
      const invalidConfig = { ...mockConfig, baseUrl: 'ftp://example.com' };
      const invalidClient = new FastGPTClient(invalidConfig);

      const result = await invalidClient.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Base URL must use HTTP or HTTPS protocol');
    });
  });

  describe('API URL Building', () => {
    test('should build correct API URL with base URL without /api', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test' })
      });

      await client.testConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://fastgpt.io/api/v1/chat/completions',
        expect.any(Object)
      );
    });

    test('should build correct API URL with base URL with /api', async () => {
      const configWithApi = { ...mockConfig, baseUrl: 'https://fastgpt.io/api' };
      const clientWithApi = new FastGPTClient(configWithApi);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test' })
      });

      await clientWithApi.testConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://fastgpt.io/api/v1/chat/completions',
        expect.any(Object)
      );
    });

    test('should handle trailing slash in base URL', async () => {
      const configWithSlash = { ...mockConfig, baseUrl: 'https://fastgpt.io/' };
      const clientWithSlash = new FastGPTClient(configWithSlash);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test' })
      });

      await clientWithSlash.testConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://fastgpt.io/api/v1/chat/completions',
        expect.any(Object)
      );
    });
  });

  describe('Request Format', () => {
    test('should send correct request format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test' })
      });

      await client.testConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://fastgpt.io/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer sk-test-api-key-12345',
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('"stream":false')
        }
      );

      // Verify request body structure
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toMatchObject({
        stream: false,
        detail: false,
        messages: [
          {
            role: 'user',
            content: 'test connection'
          }
        ]
      });
      expect(requestBody.chatId).toMatch(/^test_\d+$/);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should handle 401 authentication errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => null },
        json: async () => ({ message: 'Invalid API key' })
      });

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed: Invalid API key');
    });

    test('should handle 403 forbidden errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: { get: () => null },
        json: async () => ({ message: 'Access denied' })
      });

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Access forbidden: Check your API key permissions');
    });

    test('should handle 404 not found errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: { get: () => null },
        json: async () => ({ message: 'Endpoint not found' })
      });

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('API endpoint not found: Check your Base URL');
    });

    test('should handle 400 bad request errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: { get: () => null },
        json: async () => ({ message: 'Invalid request format' })
      });

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid request format');
    });

    test('should handle 429 rate limit errors', async () => {
      // Mock all calls to fail with 429
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { get: () => null },
        json: async () => ({ message: 'Rate limit exceeded' })
      });

      const resultPromise = client.testConnection();
      
      // Fast-forward through all retry delays
      await jest.advanceTimersByTimeAsync(20000);
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded: Too many requests');
      // Should have retried multiple times
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    test('should handle 500 server errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => null },
        json: async () => ({ message: 'Server error' })
      });

      const resultPromise = client.testConnection();
      
      // Fast-forward through retry delays
      await jest.advanceTimersByTimeAsync(20000);
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error: FastGPT service is temporarily unavailable');
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const resultPromise = client.testConnection();
      
      // Fast-forward through retry delays
      await jest.advanceTimersByTimeAsync(20000);
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error: Unable to connect to FastGPT server');
    });

    test('should handle unparseable error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => null },
        json: async () => { throw new Error('Invalid JSON'); }
      });

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });

    test('should handle unexpected errors', async () => {
      mockFetch.mockRejectedValue(new Error('Unexpected error'));

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });
  });

  describe('Chat Completion - Non-Streaming', () => {
    test('should send message and receive response', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chat-123',
        model: 'fastgpt',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        },
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finish_reason: 'stop',
            index: 0
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const response = await client.sendMessage('Hello');
      expect(response).toBe('Hello! How can I help you today?');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://fastgpt.io/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer sk-test-api-key-12345',
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('"stream":false')
        }
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toMatchObject({
        stream: false,
        detail: false,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      });
    });

    test('should send message with chatId and variables', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chat-123',
        model: 'fastgpt',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        choices: [
          {
            message: { role: 'assistant', content: 'Response with variables' },
            finish_reason: 'stop',
            index: 0
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const response = await client.sendMessage(
        'Hello',
        'chat-session-123',
        { userName: 'John', context: 'test' }
      );

      expect(response).toBe('Response with variables');

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toMatchObject({
        chatId: 'chat-session-123',
        variables: { userName: 'John', context: 'test' },
        messages: [{ role: 'user', content: 'Hello' }]
      });
    });

    test('should handle invalid response format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' })
      });

      await expect(client.sendMessage('Hello')).rejects.toThrow('Invalid response format from FastGPT API');
    });

    test('should handle API errors in sendMessage', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => null },
        json: async () => ({ message: 'Invalid API key' })
      });

      await expect(client.sendMessage('Hello')).rejects.toThrow('Authentication failed: Invalid API key');
    });
  });

  describe('Chat Completion - Streaming', () => {
    // Mock ReadableStream for streaming tests
    const createMockStream = (chunks: string[]) => {
      let index = 0;
      return {
        body: {
          getReader: () => ({
            read: async () => {
              if (index >= chunks.length) {
                return { done: true, value: undefined };
              }
              const chunk = new TextEncoder().encode(chunks[index++]);
              return { done: false, value: chunk };
            },
            releaseLock: () => {}
          })
        }
      };
    };

    test('should stream message response', async () => {
      const streamChunks = [
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Hello"},"index":0,"finish_reason":null}]}\n\n',
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":" there"},"index":0,"finish_reason":null}]}\n\n',
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"!"},"index":0,"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n'
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        ...createMockStream(streamChunks)
      });

      const chunks: string[] = [];
      for await (const chunk of client.sendMessageStream('Hello')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' there', '!']);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toMatchObject({
        stream: true,
        detail: false,
        messages: [{ role: 'user', content: 'Hello' }]
      });
    });

    test('should handle streaming with chatId and variables', async () => {
      const streamChunks = [
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Response"},"index":0,"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n'
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        ...createMockStream(streamChunks)
      });

      const chunks: string[] = [];
      for await (const chunk of client.sendMessageStream(
        'Hello',
        'chat-123',
        { test: 'value' }
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Response']);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toMatchObject({
        chatId: 'chat-123',
        variables: { test: 'value' },
        stream: true
      });
    });

    test('should handle malformed JSON in stream', async () => {
      const streamChunks = [
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Valid"},"index":0,"finish_reason":null}]}\n\n',
        'data: {invalid json}\n\n',
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Content"},"index":0,"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n'
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        ...createMockStream(streamChunks)
      });

      const chunks: string[] = [];
      for await (const chunk of client.sendMessageStream('Hello')) {
        chunks.push(chunk);
      }

      // Should skip malformed JSON and continue with valid chunks
      expect(chunks).toEqual(['Valid', 'Content']);
    });

    test('should handle streaming API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => null },
        json: async () => ({ message: 'Invalid API key' })
      });

      const generator = client.sendMessageStream('Hello');
      await expect(generator.next()).rejects.toThrow('Authentication failed: Invalid API key');
    });

    test('should handle missing response body in streaming', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: null
      });

      const generator = client.sendMessageStream('Hello');
      await expect(generator.next()).rejects.toThrow('No response body received');
    });
  });

  describe('Enhanced Streaming with Events', () => {
    // Mock ReadableStream for streaming tests
    const createMockStream = (chunks: string[]) => {
      let index = 0;
      return {
        body: {
          getReader: () => ({
            read: async () => {
              if (index >= chunks.length) {
                return { done: true, value: undefined };
              }
              const chunk = new TextEncoder().encode(chunks[index++]);
              return { done: false, value: chunk };
            },
            releaseLock: () => {}
          })
        }
      };
    };

    test('should emit streaming events for successful response', async () => {
      const streamChunks = [
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Hello"},"index":0,"finish_reason":null}]}\n\n',
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":" world"},"index":0,"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n'
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        ...createMockStream(streamChunks)
      });

      const events: any[] = [];
      for await (const event of client.sendMessageStreamWithEvents('Hello')) {
        events.push(event);
      }

      expect(events).toHaveLength(4); // start, chunk, chunk, complete
      expect(events[0].type).toBe('start');
      expect(events[0].metadata?.messageId).toBeDefined();
      expect(events[1].type).toBe('chunk');
      expect(events[1].data).toBe('Hello');
      expect(events[2].type).toBe('chunk');
      expect(events[2].data).toBe(' world');
      expect(events[3].type).toBe('complete');
      expect(events[3].metadata?.totalChunks).toBe(2);
    });

    test('should emit error event for configuration validation failure', async () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };
      const invalidClient = new FastGPTClient(invalidConfig);

      const events: any[] = [];
      for await (const event of invalidClient.sendMessageStreamWithEvents('Hello')) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].error?.type).toBe('connection');
      expect(events[0].error?.message).toBe('API Key is required');
      expect(events[0].error?.recoverable).toBe(false);
    });

    test('should emit error event for API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => null },
        json: async () => ({ message: 'Invalid API key' })
      });

      const events: any[] = [];
      for await (const event of client.sendMessageStreamWithEvents('Hello')) {
        events.push(event);
      }

      expect(events).toHaveLength(2); // start, error
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('error');
      expect(events[1].error?.type).toBe('connection');
      expect(events[1].error?.recoverable).toBe(false);
    });

    test('should handle timeout with abort signal', async () => {
      const controller = new AbortController();
      
      // Mock a slow response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              ...createMockStream(['data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Hello"},"index":0,"finish_reason":null}]}\n\n'])
            });
          }, 2000);
        })
      );

      // Abort after 1 second
      setTimeout(() => controller.abort(), 1000);

      const events: any[] = [];
      for await (const event of client.sendMessageStreamWithEvents('Hello', undefined, undefined, {
        timeout: 1500,
        abortSignal: controller.signal
      })) {
        events.push(event);
      }

      expect(events).toHaveLength(2); // start, error
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('error');
      expect(events[1].error?.type).toBe('abort');
      expect(events[1].error?.recoverable).toBe(true);
    });

    test('should handle streaming with conversation history and events', async () => {
      const mockMessages = [
        { id: '1', role: 'user' as const, content: 'Hello', timestamp: new Date() },
        { id: '2', role: 'assistant' as const, content: 'Hi!', timestamp: new Date() }
      ];

      const streamChunks = [
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"How"},"index":0,"finish_reason":null}]}\n\n',
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":" can I help?"},"index":0,"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n'
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        ...createMockStream(streamChunks)
      });

      const events: any[] = [];
      for await (const event of client.sendMessageWithHistoryStreamWithEvents(mockMessages)) {
        events.push(event);
      }

      expect(events).toHaveLength(4); // start, chunk, chunk, complete
      expect(events[0].type).toBe('start');
      expect(events[1].data).toBe('How');
      expect(events[2].data).toBe(' can I help?');
      expect(events[3].type).toBe('complete');

      // Verify request included conversation history
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ]);
    });

    test('should handle malformed JSON in enhanced streaming', async () => {
      const streamChunks = [
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Valid"},"index":0,"finish_reason":null}]}\n\n',
        'data: {invalid json}\n\n',
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Content"},"index":0,"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n'
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        ...createMockStream(streamChunks)
      });

      const events: any[] = [];
      for await (const event of client.sendMessageStreamWithEvents('Hello')) {
        events.push(event);
      }

      // Should have start, 2 valid chunks, and complete (malformed JSON skipped)
      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('start');
      expect(events[1].data).toBe('Valid');
      expect(events[2].data).toBe('Content');
      expect(events[3].type).toBe('complete');
    });

    test('should handle network errors during streaming', async () => {
      // Mock network error during fetch - make all retries fail
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const events: any[] = [];
      for await (const event of client.sendMessageStreamWithEvents('Hello')) {
        events.push(event);
      }

      expect(events).toHaveLength(2); // start, error
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('error');
      expect(events[1].error?.type).toBe('connection');
      expect(events[1].error?.message).toContain('Network');
      expect(events[1].error?.recoverable).toBe(true);
    }, 10000); // Increase timeout for retry logic

    test('should classify streaming errors correctly', async () => {
      // Test different error scenarios
      const testCases = [
        {
          error: new Error('Request was aborted'),
          expectedType: 'abort',
          expectedRecoverable: true
        },
        {
          error: new Error('Request timeout while streaming'),
          expectedType: 'timeout',
          expectedRecoverable: true
        },
        {
          error: new Error('Network connection lost during streaming'),
          expectedType: 'connection',
          expectedRecoverable: true
        },
        {
          error: new Error('Failed to parse streaming response'),
          expectedType: 'parsing',
          expectedRecoverable: false
        },
        {
          error: new Error('Authentication failed: Invalid API key'),
          expectedType: 'connection',
          expectedRecoverable: false
        }
      ];

      for (const testCase of testCases) {
        // Mock all retry attempts to fail with the same error
        mockFetch.mockRejectedValue(testCase.error);

        const events: any[] = [];
        for await (const event of client.sendMessageStreamWithEvents('Hello')) {
          events.push(event);
        }

        expect(events).toHaveLength(2); // start, error
        expect(events[1].type).toBe('error');
        expect(events[1].error?.type).toBe(testCase.expectedType);
        expect(events[1].error?.recoverable).toBe(testCase.expectedRecoverable);
        
        // Clear the mock for next iteration
        mockFetch.mockClear();
      }
    }, 15000); // Increase timeout for retry logic

    test('should handle incomplete streaming data in buffer', async () => {
      // Test streaming with incomplete data that needs buffering
      const streamChunks = [
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Partial"},"index":0,"finish_reason":null}]}\n',
        '\ndata: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":" message"},"index":0,"finish_reason":null}]}\n\n',
        'data: [DONE]'
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        ...createMockStream(streamChunks)
      });

      const events: any[] = [];
      for await (const event of client.sendMessageStreamWithEvents('Hello')) {
        events.push(event);
      }

      expect(events).toHaveLength(4); // start, chunk, chunk, complete
      expect(events[1].data).toBe('Partial');
      expect(events[2].data).toBe(' message');
    });
  });

  describe('Chat with History', () => {
    const mockMessages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date()
      },
      {
        id: '3',
        role: 'user',
        content: 'How are you?',
        timestamp: new Date()
      }
    ];

    test('should send message with conversation history', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chat-123',
        model: 'fastgpt',
        usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
        choices: [
          {
            message: { role: 'assistant', content: 'I am doing well, thank you!' },
            finish_reason: 'stop',
            index: 0
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const response = await client.sendMessageWithHistory(mockMessages);
      expect(response).toBe('I am doing well, thank you!');

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ]);
    });

    test('should stream message with conversation history', async () => {
      const streamChunks = [
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"I am"},"index":0,"finish_reason":null}]}\n\n',
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":" doing well"},"index":0,"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const createMockStream = (chunks: string[]) => {
        let index = 0;
        return {
          body: {
            getReader: () => ({
              read: async () => {
                if (index >= chunks.length) {
                  return { done: true, value: undefined };
                }
                const chunk = new TextEncoder().encode(chunks[index++]);
                return { done: false, value: chunk };
              },
              releaseLock: () => {}
            })
          }
        };
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        ...createMockStream(streamChunks)
      });

      const chunks: string[] = [];
      for await (const chunk of client.sendMessageWithHistoryStream(mockMessages)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['I am', ' doing well']);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ]);
      expect(requestBody.stream).toBe(true);
    });
  });

  describe('Configuration Validation in Chat Methods', () => {
    test('should validate configuration before sending message', async () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };
      const invalidClient = new FastGPTClient(invalidConfig);

      await expect(invalidClient.sendMessage('Hello')).rejects.toThrow('API Key is required');
    });

    test('should validate configuration before streaming message', async () => {
      const invalidConfig = { ...mockConfig, baseUrl: '' };
      const invalidClient = new FastGPTClient(invalidConfig);

      const generator = invalidClient.sendMessageStream('Hello');
      await expect(generator.next()).rejects.toThrow('Base URL is required');
    });
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should retry on network errors', async () => {
      // First two calls fail with network error, third succeeds
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'test', choices: [{ message: { content: 'success' } }] })
        });

      const responsePromise = client.sendMessage('Hello');
      
      // Fast-forward through retry delays
      jest.advanceTimersByTime(5000);
      
      const response = await responsePromise;
      expect(response).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test('should retry on 500 server errors', async () => {
      // First call fails with 500, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: { get: () => null },
          json: async () => ({ message: 'Server error' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'test', choices: [{ message: { content: 'success after retry' } }] })
        });

      const responsePromise = client.sendMessage('Hello');
      
      // Fast-forward through retry delay
      jest.advanceTimersByTime(2000);
      
      const response = await responsePromise;
      expect(response).toBe('success after retry');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should retry on 429 rate limit errors', async () => {
      // First call fails with 429, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: { get: () => '2' }, // Retry-After: 2 seconds
          json: async () => ({ message: 'Rate limit exceeded' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'test', choices: [{ message: { content: 'success after rate limit' } }] })
        });

      const responsePromise = client.sendMessage('Hello');
      
      // Fast-forward through retry delay
      jest.advanceTimersByTime(3000);
      
      const response = await responsePromise;
      expect(response).toBe('success after rate limit');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should not retry on 401 authentication errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => null },
        json: async () => ({ message: 'Invalid API key' })
      });

      await expect(client.sendMessage('Hello')).rejects.toThrow('Authentication failed: Invalid API key');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should not retry on 400 validation errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: { get: () => null },
        json: async () => ({ message: 'Invalid request' })
      });

      await expect(client.sendMessage('Hello')).rejects.toThrow('Invalid request');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should exhaust retries and throw final error', async () => {
      // All calls fail with network error
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const responsePromise = client.sendMessage('Hello');
      
      // Fast-forward through all retry delays
      jest.advanceTimersByTime(20000);
      
      await expect(responsePromise).rejects.toThrow('Network error: Unable to connect to FastGPT server');
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    test('should retry streaming requests', async () => {
      const streamChunks = [
        'data: {"id":"","object":"","created":0,"model":"","choices":[{"delta":{"role":"assistant","content":"Success"},"index":0,"finish_reason":null}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const createMockStream = (chunks: string[]) => {
        let index = 0;
        return {
          body: {
            getReader: () => ({
              read: async () => {
                if (index >= chunks.length) {
                  return { done: true, value: undefined };
                }
                const chunk = new TextEncoder().encode(chunks[index++]);
                return { done: false, value: chunk };
              },
              releaseLock: () => {}
            })
          }
        };
      };

      // First call fails with network error, second succeeds
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          ...createMockStream(streamChunks)
        });

      const generatorPromise = client.sendMessageStream('Hello');
      
      // Fast-forward through retry delay
      jest.advanceTimersByTime(2000);
      
      const generator = await generatorPromise;
      const chunks: string[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Success']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should handle connection test retries', async () => {
      // First call fails with 503, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: { get: () => null },
          json: async () => ({ message: 'Service unavailable' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'test' })
        });

      const resultPromise = client.testConnection();
      
      // Fast-forward through retry delay
      jest.advanceTimersByTime(2000);
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Enhanced Error Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should mark retryable errors correctly', async () => {
      const retryableStatuses = [429, 500, 502, 503, 504, 408];
      
      for (const status of retryableStatuses) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValue({
          ok: false,
          status,
          statusText: 'Error',
          headers: { get: () => null },
          json: async () => ({ message: 'Error' })
        });

        const resultPromise = client.testConnection();
        
        // Fast-forward through retry delays
        await jest.advanceTimersByTimeAsync(20000);
        
        const result = await resultPromise;
        expect(result.success).toBe(false);
        // Should have retried (initial + retries)
        expect(mockFetch.mock.calls.length).toBeGreaterThan(1);
      }
    });

    test('should mark non-retryable errors correctly', async () => {
      const nonRetryableStatuses = [400, 401, 403, 404];
      
      for (const status of nonRetryableStatuses) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValue({
          ok: false,
          status,
          statusText: 'Error',
          headers: { get: () => null },
          json: async () => ({ message: 'Error' })
        });

        const result = await client.testConnection();
        expect(result.success).toBe(false);
        // Should not have retried
        expect(mockFetch).toHaveBeenCalledTimes(1);
      }
    });

    test('should handle 408 request timeout errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 408,
        statusText: 'Request Timeout',
        headers: { get: () => null },
        json: async () => ({ message: 'Request timeout' })
      });

      const resultPromise = client.testConnection();
      
      // Fast-forward through retry delays
      jest.advanceTimersByTime(20000);
      
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout: The server took too long to respond');
    });

    test('should handle Retry-After header in rate limit responses', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: { get: (header: string) => header === 'Retry-After' ? '5' : null },
          json: async () => ({ message: 'Rate limit exceeded' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'test', choices: [{ message: { content: 'success' } }] })
        });

      const responsePromise = client.sendMessage('Hello');
      
      // Fast-forward through retry delay (should respect Retry-After)
      jest.advanceTimersByTime(6000);
      
      const response = await responsePromise;
      expect(response).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should provide enhanced error messages for different scenarios', () => {
      const testCases = [
        {
          error: { message: 'Network failed', type: 'network' as const, retryable: true },
          expected: 'Unable to connect to FastGPT server. Please check your internet connection and Base URL.'
        },
        {
          error: { message: 'Invalid key', type: 'authentication' as const, retryable: false },
          expected: 'Authentication failed. Please check your API key and ensure it has the correct permissions.'
        },
        {
          error: { message: 'Bad config', type: 'validation' as const, retryable: false },
          expected: 'Configuration error. Please verify your Base URL, App ID, and API key are correct.'
        },
        {
          error: { message: 'Server down', type: 'server' as const, retryable: true },
          expected: 'FastGPT server is temporarily unavailable. Please try again later.'
        }
      ];

      testCases.forEach(({ error, expected }) => {
        const message = FastGPTClient.getErrorMessage(error);
        expect(message).toBe(expected);
      });
    });
  });

  describe('Error Message Utility', () => {
    test('should provide user-friendly messages for network errors', () => {
      const error: FastGPTApiError = {
        message: 'Network connection failed',
        type: 'network'
      };

      const message = FastGPTClient.getErrorMessage(error);
      expect(message).toBe('Unable to connect to FastGPT server. Please check your internet connection and Base URL.');
    });

    test('should provide user-friendly messages for authentication errors', () => {
      const error: FastGPTApiError = {
        message: 'Invalid API key',
        type: 'authentication'
      };

      const message = FastGPTClient.getErrorMessage(error);
      expect(message).toBe('Authentication failed. Please check your API key and ensure it has the correct permissions.');
    });

    test('should provide user-friendly messages for validation errors', () => {
      const error: FastGPTApiError = {
        message: 'Invalid configuration',
        type: 'validation'
      };

      const message = FastGPTClient.getErrorMessage(error);
      expect(message).toBe('Configuration error. Please verify your Base URL, App ID, and API key are correct.');
    });

    test('should provide user-friendly messages for server errors', () => {
      const error: FastGPTApiError = {
        message: 'Server unavailable',
        type: 'server'
      };

      const message = FastGPTClient.getErrorMessage(error);
      expect(message).toBe('FastGPT server is temporarily unavailable. Please try again later.');
    });

    test('should provide fallback message for unknown errors', () => {
      const error: FastGPTApiError = {
        message: 'Unknown error occurred',
        type: 'unknown'
      };

      const message = FastGPTClient.getErrorMessage(error);
      expect(message).toBe('Unknown error occurred');
    });

    test('should handle missing error message', () => {
      const error: FastGPTApiError = {
        message: '',
        type: 'unknown'
      };

      const message = FastGPTClient.getErrorMessage(error);
      expect(message).toBe('An unexpected error occurred during connection test.');
    });
  });
});