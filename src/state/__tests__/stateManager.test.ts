import { ExtensionStateManager } from '../stateManager';
import { ChromeStorageManager } from '../../storage/storage';
import { ExtensionState, FastGPTConfig } from '../../types/storage';

// Mock Chrome APIs
const mockChromeStorage = {
  local: {
    set: jest.fn(),
    get: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn()
  }
};

const mockChromeRuntime = {
  lastError: null
};

// Setup global mocks
(global as any).chrome = {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime
};

describe('ExtensionStateManager', () => {
  let stateManager: ExtensionStateManager;
  let mockStorageManager: jest.Mocked<ChromeStorageManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock storage manager
    mockStorageManager = {
      getExtensionState: jest.fn(),
      getSetupState: jest.fn(),
      setSetupState: jest.fn(),
      setFastGPTConfig: jest.fn(),
      removeData: jest.fn(),
      clearAllData: jest.fn(),
      getFastGPTConfig: jest.fn(),
      setChatSession: jest.fn(),
      getChatSessions: jest.fn(),
      setPreferences: jest.fn(),
      getPreferences: jest.fn()
    } as any;

    stateManager = new ExtensionStateManager(mockStorageManager);
  });

  describe('initialization', () => {
    it('should initialize with default state when no stored state exists', async () => {
      const defaultState: ExtensionState = {
        setupComplete: false,
        configurationComplete: false,
        currentView: 'onboarding'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: defaultState
      });

      const result = await stateManager.initialize();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(defaultState);
      expect(stateManager.getCurrentState()).toEqual(defaultState);
    });

    it('should handle initialization errors gracefully', async () => {
      mockStorageManager.getExtensionState.mockResolvedValue({
        success: false,
        error: 'Storage error'
      });

      const result = await stateManager.initialize();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
      expect(stateManager.getCurrentState()).toBeNull();
    });
  });

  describe('state loading', () => {
    it('should load state from storage successfully', async () => {
      const storedState: ExtensionState = {
        setupComplete: true,
        configurationComplete: false,
        currentView: 'configuration',
        fastgptConfig: {
          baseUrl: 'https://api.fastgpt.io',
          appId: 'test-app',
          apiKey: 'test-key'
        }
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: storedState
      });

      const result = await stateManager.loadState();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(storedState);
      expect(stateManager.getCurrentState()).toEqual(storedState);
    });

    it('should handle storage errors during state loading', async () => {
      mockStorageManager.getExtensionState.mockRejectedValue(new Error('Storage unavailable'));

      const result = await stateManager.loadState();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load state');
    });
  });

  describe('onboarding completion', () => {
    it('should complete onboarding successfully', async () => {
      const initialSetupState = {
        onboardingComplete: false,
        configurationComplete: false
      };

      const updatedState: ExtensionState = {
        setupComplete: true,
        configurationComplete: false,
        currentView: 'configuration'
      };

      mockStorageManager.getSetupState.mockResolvedValue({
        success: true,
        data: initialSetupState
      });

      mockStorageManager.setSetupState.mockResolvedValue({ success: true });

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: updatedState
      });

      const result = await stateManager.completeOnboarding();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedState);
      expect(mockStorageManager.setSetupState).toHaveBeenCalledWith(true, false);
    });

    it('should handle errors during onboarding completion', async () => {
      mockStorageManager.getSetupState.mockResolvedValue({
        success: false,
        error: 'Failed to get setup state'
      });

      const result = await stateManager.completeOnboarding();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get setup state');
    });
  });

  describe('configuration completion', () => {
    it('should complete configuration successfully', async () => {
      const config: FastGPTConfig = {
        baseUrl: 'https://api.fastgpt.io',
        appId: 'test-app',
        apiKey: 'test-key'
      };

      const initialSetupState = {
        onboardingComplete: true,
        configurationComplete: false
      };

      const updatedState: ExtensionState = {
        setupComplete: true,
        configurationComplete: true,
        currentView: 'chat',
        fastgptConfig: config
      };

      mockStorageManager.setFastGPTConfig.mockResolvedValue({ success: true });
      mockStorageManager.getSetupState.mockResolvedValue({
        success: true,
        data: initialSetupState
      });
      mockStorageManager.setSetupState.mockResolvedValue({ success: true });
      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: updatedState
      });

      const result = await stateManager.completeConfiguration(config);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedState);
      expect(mockStorageManager.setFastGPTConfig).toHaveBeenCalledWith(config);
      expect(mockStorageManager.setSetupState).toHaveBeenCalledWith(true, true);
    });

    it('should handle configuration save errors', async () => {
      const config: FastGPTConfig = {
        baseUrl: 'https://api.fastgpt.io',
        appId: 'test-app',
        apiKey: 'test-key'
      };

      mockStorageManager.setFastGPTConfig.mockResolvedValue({
        success: false,
        error: 'Failed to save config'
      });

      const result = await stateManager.completeConfiguration(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to save config');
    });
  });

  describe('state reset operations', () => {
    it('should reset onboarding state successfully', async () => {
      const initialSetupState = {
        onboardingComplete: true,
        configurationComplete: true
      };

      const updatedState: ExtensionState = {
        setupComplete: false,
        configurationComplete: true,
        currentView: 'onboarding'
      };

      mockStorageManager.getSetupState.mockResolvedValue({
        success: true,
        data: initialSetupState
      });
      mockStorageManager.setSetupState.mockResolvedValue({ success: true });
      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: updatedState
      });

      const result = await stateManager.resetOnboarding();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedState);
      expect(mockStorageManager.setSetupState).toHaveBeenCalledWith(false, true);
    });

    it('should reset configuration state successfully', async () => {
      const initialSetupState = {
        onboardingComplete: true,
        configurationComplete: true
      };

      const updatedState: ExtensionState = {
        setupComplete: true,
        configurationComplete: false,
        currentView: 'configuration'
      };

      mockStorageManager.removeData.mockResolvedValue({ success: true });
      mockStorageManager.getSetupState.mockResolvedValue({
        success: true,
        data: initialSetupState
      });
      mockStorageManager.setSetupState.mockResolvedValue({ success: true });
      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: updatedState
      });

      const result = await stateManager.resetConfiguration();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedState);
      expect(mockStorageManager.removeData).toHaveBeenCalledWith(['fastgptConfig']);
      expect(mockStorageManager.setSetupState).toHaveBeenCalledWith(true, false);
    });

    it('should reset all state successfully', async () => {
      const defaultState: ExtensionState = {
        setupComplete: false,
        configurationComplete: false,
        currentView: 'onboarding'
      };

      mockStorageManager.clearAllData.mockResolvedValue({ success: true });
      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: defaultState
      });

      const result = await stateManager.resetAllState();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(defaultState);
      expect(mockStorageManager.clearAllData).toHaveBeenCalled();
    });
  });

  describe('state validation methods', () => {
    beforeEach(async () => {
      const initialState: ExtensionState = {
        setupComplete: true,
        configurationComplete: true,
        currentView: 'chat'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: initialState
      });

      await stateManager.initialize();
    });

    it('should correctly identify when ready for chat', () => {
      expect(stateManager.isReadyForChat()).toBe(true);
    });

    it('should correctly identify onboarding completion', () => {
      expect(stateManager.isOnboardingComplete()).toBe(true);
    });

    it('should correctly identify configuration completion', () => {
      expect(stateManager.isConfigurationComplete()).toBe(true);
    });

    it('should return correct current view', () => {
      expect(stateManager.getCurrentView()).toBe('chat');
    });
  });

  describe('state transition validation', () => {
    it('should allow transition to onboarding from any state', () => {
      expect(stateManager.canTransitionTo('onboarding')).toBe(true);
    });

    it('should validate configuration transition requirements', async () => {
      // Setup state with onboarding complete
      const state: ExtensionState = {
        setupComplete: true,
        configurationComplete: false,
        currentView: 'configuration'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: state
      });

      await stateManager.initialize();

      expect(stateManager.canTransitionTo('configuration')).toBe(true);
      expect(stateManager.canTransitionTo('chat')).toBe(false);
    });

    it('should validate chat transition requirements', async () => {
      // Setup state with both onboarding and configuration complete
      const state: ExtensionState = {
        setupComplete: true,
        configurationComplete: true,
        currentView: 'chat'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: state
      });

      await stateManager.initialize();

      expect(stateManager.canTransitionTo('chat')).toBe(true);
    });

    it('should handle forced transitions correctly', async () => {
      const state: ExtensionState = {
        setupComplete: true,
        configurationComplete: true,
        currentView: 'chat'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: state
      });

      await stateManager.initialize();

      const result = await stateManager.forceTransitionTo('configuration');

      expect(result.success).toBe(true);
      expect(stateManager.getCurrentView()).toBe('configuration');
    });

    it('should reject invalid forced transitions', async () => {
      const state: ExtensionState = {
        setupComplete: false,
        configurationComplete: false,
        currentView: 'onboarding'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: state
      });

      await stateManager.initialize();

      const result = await stateManager.forceTransitionTo('chat');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid state transition');
    });
  });

  describe('state change listeners', () => {
    it('should notify listeners on state changes', async () => {
      const listener = jest.fn();
      stateManager.addStateChangeListener(listener);

      const state: ExtensionState = {
        setupComplete: true,
        configurationComplete: false,
        currentView: 'configuration'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: state
      });

      await stateManager.loadState();

      expect(listener).toHaveBeenCalledWith(state);
    });

    it('should remove listeners correctly', async () => {
      const listener = jest.fn();
      stateManager.addStateChangeListener(listener);
      stateManager.removeStateChangeListener(listener);

      const state: ExtensionState = {
        setupComplete: true,
        configurationComplete: false,
        currentView: 'configuration'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: state
      });

      await stateManager.loadState();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      stateManager.addStateChangeListener(errorListener);
      stateManager.addStateChangeListener(normalListener);

      const state: ExtensionState = {
        setupComplete: true,
        configurationComplete: false,
        currentView: 'configuration'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: state
      });

      await stateManager.loadState();

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error in state change listener:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('data integrity', () => {
    it('should maintain state consistency during multiple operations', async () => {
      // Initialize with default state
      let currentState: ExtensionState = {
        setupComplete: false,
        configurationComplete: false,
        currentView: 'onboarding'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: currentState
      });

      await stateManager.initialize();
      expect(stateManager.getCurrentView()).toBe('onboarding');

      // Complete onboarding
      mockStorageManager.getSetupState.mockResolvedValue({
        success: true,
        data: { onboardingComplete: false, configurationComplete: false }
      });
      mockStorageManager.setSetupState.mockResolvedValue({ success: true });

      currentState = {
        setupComplete: true,
        configurationComplete: false,
        currentView: 'configuration'
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: currentState
      });

      await stateManager.completeOnboarding();
      expect(stateManager.getCurrentView()).toBe('configuration');

      // Complete configuration
      const config: FastGPTConfig = {
        baseUrl: 'https://api.fastgpt.io',
        appId: 'test-app',
        apiKey: 'test-key'
      };

      mockStorageManager.setFastGPTConfig.mockResolvedValue({ success: true });
      mockStorageManager.getSetupState.mockResolvedValue({
        success: true,
        data: { onboardingComplete: true, configurationComplete: false }
      });
      mockStorageManager.setSetupState.mockResolvedValue({ success: true });

      currentState = {
        setupComplete: true,
        configurationComplete: true,
        currentView: 'chat',
        fastgptConfig: config
      };

      mockStorageManager.getExtensionState.mockResolvedValue({
        success: true,
        data: currentState
      });

      await stateManager.completeConfiguration(config);
      expect(stateManager.getCurrentView()).toBe('chat');
      expect(stateManager.isReadyForChat()).toBe(true);
    });
  });
});