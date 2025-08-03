// Storage types and interfaces for the FastGPT Chrome Extension

export interface FastGPTConfig {
  baseUrl: string;
  appId: string;
  apiKey: string;
}

export interface ExtensionState {
  setupComplete: boolean;
  configurationComplete: boolean;
  currentView: 'onboarding' | 'configuration' | 'chat';
  fastgptConfig?: FastGPTConfig;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtensionStorage {
  // Configuration data
  fastgptConfig?: {
    baseUrl: string;
    appId: string;
    apiKey: string; // Encrypted
  };
  
  // Setup progress
  setupState: {
    onboardingComplete: boolean;
    configurationComplete: boolean;
  };
  
  // Chat data
  chatSessions: {
    [sessionId: string]: {
      messages: ChatMessage[];
      createdAt: string;
      updatedAt: string;
    };
  };
  
  // User preferences
  preferences: {
    theme?: 'light' | 'dark';
    streamingEnabled: boolean;
  };
}

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface EncryptionService {
  encrypt(data: string): Promise<string>;
  decrypt(encryptedData: string): Promise<string>;
}