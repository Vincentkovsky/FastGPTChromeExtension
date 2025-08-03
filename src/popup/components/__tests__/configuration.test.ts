import { ConfigurationComponent } from '../configuration';
import { ExtensionStateManager } from '../../../state/stateManager';
import { ChromeStorageManager } from '../../../storage/storage';
import { FastGPTConfig } from '../../../types/storage';
import { FastGPTClient } from '../../../api/fastgptClient';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  }
};

(global as any).chrome = mockChrome;

describe('ConfigurationComponent', () => {
  let configComponent: ConfigurationComponent;
  let mockStateManager: ExtensionStateManager;
  let mockStorageManager: ChromeStorageManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock storage manager
    mockStorageManager = new ChromeStorageManager();
    
    // Create mock state manager
    mockStateManager = new ExtensionStateManager(mockStorageManager);
    
    // Create configuration component
    configComponent = new ConfigurationComponent(mockStateManager);
  });



  describe('Configuration Persistence and Retrieval', () => {
    test('should load existing configuration from storage', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://fastgpt.io',
        appId: 'test-app-123',
        apiKey: 'sk-test-api-key-12345'
      };

      // Mock the storage to return existing configuration
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        const result: any = {};
        if (keys.includes('fastgptConfig')) {
          result.fastgptConfig = {
            baseUrl: mockConfig.baseUrl,
            appId: mockConfig.appId,
            apiKey: 'encrypted-api-key'
          };
        }
        if (keys.includes('setupState')) {
          result.setupState = {
            onboardingComplete: true,
            configurationComplete: true
          };
        }
        callback(result);
      });

      // Mock encryption service to return decrypted API key
      const mockDecrypt = jest.spyOn(mockStorageManager['encryptionService'], 'decrypt')
        .mockResolvedValue(mockConfig.apiKey);

      // Mock state manager to return the loaded state
      jest.spyOn(mockStateManager, 'loadState').mockResolvedValue({
        success: true,
        data: {
          setupComplete: true,
          configurationComplete: true,
          currentView: 'configuration' as const,
          fastgptConfig: mockConfig
        }
      });

      jest.spyOn(mockStateManager, 'getCurrentState').mockReturnValue({
        setupComplete: true,
        configurationComplete: true,
        currentView: 'configuration' as const,
        fastgptConfig: mockConfig
      });

      // Load existing configuration
      const component = configComponent as any;
      await component.loadExistingConfiguration();

      // Verify configuration was loaded
      expect(component.formData).toEqual(mockConfig);
      expect(mockStateManager.loadState).toHaveBeenCalled();
    });

    test('should handle empty configuration gracefully', async () => {
      // Mock empty storage
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const component = configComponent as any;
      await component.loadExistingConfiguration();

      // Verify form data is empty
      expect(component.formData).toEqual({});
    });

    test('should save configuration successfully', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://fastgpt.io',
        appId: 'test-app-123',
        apiKey: 'sk-test-api-key-12345'
      };

      // Mock successful storage operations
      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        const result: any = {};
        if (keys.includes('setupState')) {
          result.setupState = {
            onboardingComplete: true,
            configurationComplete: false
          };
        }
        callback(result);
      });

      // Mock encryption service
      const mockEncrypt = jest.spyOn(mockStorageManager['encryptionService'], 'encrypt')
        .mockResolvedValue('encrypted-api-key');

      // Set form data and submit
      const component = configComponent as any;
      component.formData = mockConfig;

      // Mock DOM elements for form submission
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="save-configuration">Save Configuration</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      await component.handleFormSubmit();

      // Verify encryption and storage were called
      expect(mockEncrypt).toHaveBeenCalledWith(mockConfig.apiKey);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          fastgptConfig: {
            baseUrl: mockConfig.baseUrl,
            appId: mockConfig.appId,
            apiKey: 'encrypted-api-key'
          }
        }),
        expect.any(Function)
      );
    });

    test('should handle configuration save errors', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://fastgpt.io',
        appId: 'test-app-123',
        apiKey: 'sk-test-api-key-12345'
      };

      // Mock storage error
      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        chrome.runtime.lastError = { message: 'Storage quota exceeded' };
        callback();
      });

      // Mock encryption service
      jest.spyOn(mockStorageManager['encryptionService'], 'encrypt')
        .mockResolvedValue('encrypted-api-key');

      const component = configComponent as any;
      component.formData = mockConfig;

      // Mock DOM elements
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="save-configuration">Save Configuration</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      await component.handleFormSubmit();

      // Verify error handling
      const errorMessage = mockContainer.querySelector('.message-error');
      expect(errorMessage).toBeTruthy();
    });



    test('should handle encryption errors during save', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://fastgpt.io',
        appId: 'test-app-123',
        apiKey: 'sk-test-api-key-12345'
      };

      // Mock encryption failure
      jest.spyOn(mockStorageManager['encryptionService'], 'encrypt')
        .mockRejectedValue(new Error('Encryption failed'));

      const component = configComponent as any;
      component.formData = mockConfig;

      // Mock DOM elements
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="save-configuration">Save Configuration</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      await component.handleFormSubmit();

      // Verify error handling
      const errorMessage = mockContainer.querySelector('.message-error');
      expect(errorMessage).toBeTruthy();
      expect(mockChrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('Connection Testing', () => {
    // Mock fetch globally
    const mockFetch = jest.fn();
    (global as any).fetch = mockFetch;

    beforeEach(() => {
      mockFetch.mockClear();
    });

    test('should test connection successfully', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://fastgpt.io',
        appId: 'test-app-123',
        apiKey: 'sk-test-api-key-12345'
      };

      // Mock successful API response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test-response',
          choices: [{ message: { content: 'test response' } }]
        })
      });

      const component = configComponent as any;
      component.formData = mockConfig;

      // Mock DOM elements
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="test-connection">Test Connection</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      await component.handleTestConnection();

      // Verify API was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        'https://fastgpt.io/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer sk-test-api-key-12345',
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('"content":"test connection"')
        })
      );

      // Verify success message is shown
      const successMessage = mockContainer.querySelector('.message-success');
      expect(successMessage).toBeTruthy();
      expect(successMessage?.textContent).toContain('Connection test successful');
    });

    test('should handle authentication errors (401)', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://fastgpt.io',
        appId: 'test-app-123',
        apiKey: 'invalid-api-key'
      };

      // Mock 401 response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid API key' })
      });

      const component = configComponent as any;
      component.formData = mockConfig;

      // Mock DOM elements
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="test-connection">Test Connection</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      await component.handleTestConnection();

      // Verify error message is shown
      const errorMessage = mockContainer.querySelector('.message-error');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toContain('Authentication failed');
    });

    test('should handle network errors', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://invalid-url.com',
        appId: 'test-app-123',
        apiKey: 'sk-test-api-key-12345'
      };

      // Mock network error
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const component = configComponent as any;
      component.formData = mockConfig;

      // Mock DOM elements
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="test-connection">Test Connection</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      await component.handleTestConnection();

      // Verify error message is shown
      const errorMessage = mockContainer.querySelector('.message-error');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toContain('Unable to connect to FastGPT server');
    });

    test('should handle server errors (500)', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://fastgpt.io',
        appId: 'test-app-123',
        apiKey: 'sk-test-api-key-12345'
      };

      // Mock 500 response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' })
      });

      const component = configComponent as any;
      component.formData = mockConfig;

      // Mock DOM elements
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="test-connection">Test Connection</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      await component.handleTestConnection();

      // Verify error message is shown
      const errorMessage = mockContainer.querySelector('.message-error');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toContain('FastGPT server is temporarily unavailable');
    });

    test('should handle 404 errors (invalid endpoint)', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://wrong-url.com',
        appId: 'test-app-123',
        apiKey: 'sk-test-api-key-12345'
      };

      // Mock 404 response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Endpoint not found' })
      });

      const component = configComponent as any;
      component.formData = mockConfig;

      // Mock DOM elements
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="test-connection">Test Connection</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      await component.handleTestConnection();

      // Verify error message is shown
      const errorMessage = mockContainer.querySelector('.message-error');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toContain('API endpoint not found');
    });

    test('should test connection with any form data', async () => {
      const config = {
        baseUrl: 'https://fastgpt.io',
        appId: 'test-app',
        apiKey: 'test-key'
      };

      // Mock successful API response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test-response',
          choices: [{ message: { content: 'test response' } }]
        })
      });

      const component = configComponent as any;
      component.formData = config;

      // Mock DOM elements
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="test-connection">Test Connection</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      await component.handleTestConnection();

      // Verify API was called
      expect(mockFetch).toHaveBeenCalled();
      
      // Verify success message is shown
      const successMessage = mockContainer.querySelector('.message-success');
      expect(successMessage).toBeTruthy();
    });

    test('should show loading state during connection test', async () => {
      const mockConfig: FastGPTConfig = {
        baseUrl: 'https://fastgpt.io',
        appId: 'test-app-123',
        apiKey: 'sk-test-api-key-12345'
      };

      // Mock delayed response
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValue(delayedPromise);

      const component = configComponent as any;
      component.formData = mockConfig;

      // Mock DOM elements
      const mockContainer = document.createElement('div');
      mockContainer.innerHTML = `
        <button id="test-connection">Test Connection</button>
        <button id="save-configuration">Save Configuration</button>
        <div class="configuration-form"></div>
      `;
      component.container = mockContainer;

      // Start connection test
      const testPromise = component.handleTestConnection();

      // Check loading state
      const testButton = mockContainer.querySelector('#test-connection') as HTMLButtonElement;
      const saveButton = mockContainer.querySelector('#save-configuration') as HTMLButtonElement;
      
      expect(testButton.disabled).toBe(true);
      expect(testButton.textContent).toBe('Testing...');
      expect(saveButton.disabled).toBe(true);

      // Resolve the promise
      resolvePromise!({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test', choices: [{ message: { content: 'test' } }] })
      });

      await testPromise;

      // Check that loading state is cleared
      expect(testButton.disabled).toBe(false);
      expect(testButton.textContent).toBe('Test Connection');
      expect(saveButton.disabled).toBe(false);
    });

    test('should get user-friendly error messages', () => {
      const component = configComponent as any;

      // Test different error types
      expect(component.getUserFriendlyErrorMessage('Network error: fetch failed'))
        .toContain('Unable to connect to FastGPT server');

      expect(component.getUserFriendlyErrorMessage('Authentication failed'))
        .toContain('Authentication failed');

      expect(component.getUserFriendlyErrorMessage('Access forbidden'))
        .toContain('Access forbidden');

      expect(component.getUserFriendlyErrorMessage('API endpoint not found'))
        .toContain('API endpoint not found');

      expect(component.getUserFriendlyErrorMessage('Bad request'))
        .toContain('Invalid configuration');

      expect(component.getUserFriendlyErrorMessage('Rate limit exceeded'))
        .toContain('Too many requests');

      expect(component.getUserFriendlyErrorMessage('Server error'))
        .toContain('FastGPT server is temporarily unavailable');

      expect(component.getUserFriendlyErrorMessage('Invalid Base URL'))
        .toContain('Invalid Base URL');

      expect(component.getUserFriendlyErrorMessage('Invalid App ID'))
        .toContain('Invalid App ID');

      expect(component.getUserFriendlyErrorMessage('Invalid API Key'))
        .toContain('Invalid API Key');

      expect(component.getUserFriendlyErrorMessage('Unknown error'))
        .toBe('Unknown error');
    });
  });
});