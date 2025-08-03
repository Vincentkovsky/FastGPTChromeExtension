// Mock Chrome APIs for testing
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  runtime: {
    lastError: null,
    id: 'test-extension-id',
  },
};

// Mock Web APIs
const mockTextEncoder = class {
  encode(input: string): Uint8Array {
    const bytes = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      bytes[i] = input.charCodeAt(i);
    }
    return bytes;
  }
};

const mockTextDecoder = class {
  decode(input: Uint8Array): string {
    return String.fromCharCode(...Array.from(input));
  }
};

// Mock btoa and atob
const mockBtoa = (str: string): string => {
  return Buffer.from(str, 'binary').toString('base64');
};

const mockAtob = (str: string): string => {
  return Buffer.from(str, 'base64').toString('binary');
};

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
  getRandomValues: jest.fn((array: Uint8Array) => {
    // Fill with predictable values for testing
    for (let i = 0; i < array.length; i++) {
      array[i] = i % 256;
    }
    return array;
  }),
};

// Make APIs available globally
(global as any).chrome = mockChrome;
(global as any).TextEncoder = mockTextEncoder;
(global as any).TextDecoder = mockTextDecoder;
(global as any).btoa = mockBtoa;
(global as any).atob = mockAtob;
(global as any).crypto = mockCrypto;

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockChrome.runtime.lastError = null;
});