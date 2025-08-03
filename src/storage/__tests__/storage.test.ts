import { ChromeStorageManager } from '../storage';
import { EncryptionService, FastGPTConfig, ChatSession } from '../../types/storage';

// Mock encryption service
class MockEncryptionService implements EncryptionService {
  async encrypt(data: string): Promise<string> {
    return `encrypted_${data}`;
  }

  async decrypt(encryptedData: string): Promise<string> {
    return encryptedData.replace('encrypted_', '');
  }
}

describe('ChromeStorageManager', () => {
  let storageManager: ChromeStorageManager;
  let mockEncryptionService: MockEncryptionService;
  let mockChromeStorage: any;

  beforeEach(() => {
    mockEncryptionService = new MockEncryptionService();
    storageManager = new ChromeStorageManager(mockEncryptionService);
    
    // Setup Chrome storage mock
    mockChromeStorage = {
      local: {
        set: jest.fn((data, callback) => callback()),
        get: jest.fn((keys, callback) => callback({})),
        remove: jest.fn((keys, callback) => callback()),
        clear: jest.fn((callback) => callback()),
      }
    };
    
    (global as any).chrome = {
      storage: mockChromeStorage,
      runtime: { lastError: null }
    };
  });

  describe('FastGPT Configuration', () => {
    const testConfig: FastGPTConfig = {
      baseUrl: 'https://api.fastgpt.io',
      appId: 'test-app-id',
      apiKey: 'test-api-key'
    };

    it('should store FastGPT config with encrypted API key', async () => {
      const result = await storageManager.setFastGPTConfig(testConfig);

      expect(result.success).toBe(true);
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        fastgptConfig: {
          baseUrl: testConfig.baseUrl,
          appId: testConfig.appId,
          apiKey: 'encrypted_test-api-key'
        }
      }, expect.any(Function));
    });

    it('should retrieve FastGPT config with decrypted API key', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({
          fastgptConfig: {
            baseUrl: testConfig.baseUrl,
            appId: testConfig.appId,
            apiKey: 'encrypted_test-api-key'
          }
        });
      });

      const result = await storageManager.getFastGPTConfig();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(testConfig);
    });

    it('should return null when no config exists', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await storageManager.getFastGPTConfig();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle encryption errors when storing config', async () => {
      jest.spyOn(mockEncryptionService, 'encrypt').mockRejectedValue(new Error('Encryption failed'));

      const result = await storageManager.setFastGPTConfig(testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to store FastGPT config');
    });

    it('should handle decryption errors when retrieving config', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({
          fastgptConfig: {
            baseUrl: testConfig.baseUrl,
            appId: testConfig.appId,
            apiKey: 'invalid-encrypted-data'
          }
        });
      });

      jest.spyOn(mockEncryptionService, 'decrypt').mockRejectedValue(new Error('Decryption failed'));

      const result = await storageManager.getFastGPTConfig();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to retrieve FastGPT config');
    });
  });

  describe('Setup State Management', () => {
    it('should store setup state', async () => {
      const result = await storageManager.setSetupState(true, false);

      expect(result.success).toBe(true);
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        setupState: {
          onboardingComplete: true,
          configurationComplete: false
        }
      }, expect.any(Function));
    });

    it('should retrieve setup state', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({
          setupState: {
            onboardingComplete: true,
            configurationComplete: false
          }
        });
      });

      const result = await storageManager.getSetupState();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        onboardingComplete: true,
        configurationComplete: false
      });
    });

    it('should return default state when no state exists', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await storageManager.getSetupState();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        onboardingComplete: false,
        configurationComplete: false
      });
    });
  });

  describe('Chat Session Management', () => {
    const testSession: ChatSession = {
      id: 'test-session-1',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date('2023-01-01T10:00:00Z')
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date('2023-01-01T10:00:01Z')
        }
      ],
      createdAt: new Date('2023-01-01T10:00:00Z'),
      updatedAt: new Date('2023-01-01T10:00:01Z')
    };

    it('should store chat session', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await storageManager.setChatSession('test-session-1', testSession);

      expect(result.success).toBe(true);
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        chatSessions: {
          'test-session-1': {
            messages: testSession.messages,
            createdAt: '2023-01-01T10:00:00.000Z',
            updatedAt: '2023-01-01T10:00:01.000Z'
          }
        }
      }, expect.any(Function));
    });

    it('should retrieve chat sessions', async () => {
      const storedSessions = {
        'test-session-1': {
          messages: testSession.messages,
          createdAt: '2023-01-01T10:00:00.000Z',
          updatedAt: '2023-01-01T10:00:01.000Z'
        }
      };

      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ chatSessions: storedSessions });
      });

      const result = await storageManager.getChatSessions();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(storedSessions);
    });
  });

  describe('User Preferences', () => {
    it('should store user preferences', async () => {
      const preferences = { theme: 'dark' as const, streamingEnabled: false };
      
      const result = await storageManager.setPreferences(preferences);

      expect(result.success).toBe(true);
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        preferences
      }, expect.any(Function));
    });

    it('should retrieve user preferences', async () => {
      const preferences = { theme: 'dark' as const, streamingEnabled: false };
      
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ preferences });
      });

      const result = await storageManager.getPreferences();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(preferences);
    });

    it('should return default preferences when none exist', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const result = await storageManager.getPreferences();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ streamingEnabled: true });
    });
  });

  describe('Extension State', () => {
    it('should return onboarding state when setup not complete', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('setupState')) {
          callback({
            setupState: {
              onboardingComplete: false,
              configurationComplete: false
            }
          });
        } else {
          callback({});
        }
      });

      const result = await storageManager.getExtensionState();

      expect(result.success).toBe(true);
      expect(result.data?.currentView).toBe('onboarding');
      expect(result.data?.setupComplete).toBe(false);
      expect(result.data?.configurationComplete).toBe(false);
    });

    it('should return configuration state when onboarding complete but config not complete', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('setupState')) {
          callback({
            setupState: {
              onboardingComplete: true,
              configurationComplete: false
            }
          });
        } else {
          callback({});
        }
      });

      const result = await storageManager.getExtensionState();

      expect(result.success).toBe(true);
      expect(result.data?.currentView).toBe('configuration');
      expect(result.data?.setupComplete).toBe(true);
      expect(result.data?.configurationComplete).toBe(false);
    });

    it('should return chat state when both setup and config complete', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('setupState')) {
          callback({
            setupState: {
              onboardingComplete: true,
              configurationComplete: true
            }
          });
        } else {
          callback({});
        }
      });

      const result = await storageManager.getExtensionState();

      expect(result.success).toBe(true);
      expect(result.data?.currentView).toBe('chat');
      expect(result.data?.setupComplete).toBe(true);
      expect(result.data?.configurationComplete).toBe(true);
    });
  });

  describe('Data Management', () => {
    it('should clear all data', async () => {
      const result = await storageManager.clearAllData();

      expect(result.success).toBe(true);
      expect(mockChromeStorage.local.clear).toHaveBeenCalled();
    });

    it('should remove specific data keys', async () => {
      const keysToRemove = ['fastgptConfig', 'chatSessions'];
      
      const result = await storageManager.removeData(keysToRemove);

      expect(result.success).toBe(true);
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(keysToRemove, expect.any(Function));
    });

    it('should handle Chrome storage errors', async () => {
      (global as any).chrome.runtime.lastError = { message: 'Storage error' };
      
      const result = await storageManager.clearAllData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to clear data');
      
      // Reset for other tests
      (global as any).chrome.runtime.lastError = null;
    });
  });
});