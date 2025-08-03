import { 
  ExtensionStorage, 
  FastGPTConfig, 
  ExtensionState, 
  ChatSession, 
  StorageResult,
  EncryptionService 
} from '../types/storage';
import { ChromeEncryptionService } from './encryption';

/**
 * Chrome Storage wrapper with encryption for sensitive data
 * Provides a secure interface for storing and retrieving extension data
 */
export class ChromeStorageManager {
  private encryptionService: EncryptionService;

  constructor(encryptionService?: EncryptionService) {
    this.encryptionService = encryptionService || new ChromeEncryptionService();
  }

  /**
   * Store FastGPT configuration with encrypted API key
   */
  async setFastGPTConfig(config: FastGPTConfig): Promise<StorageResult<void>> {
    try {
      const encryptedApiKey = await this.encryptionService.encrypt(config.apiKey);
      
      const storageData = {
        fastgptConfig: {
          baseUrl: config.baseUrl,
          appId: config.appId,
          apiKey: encryptedApiKey
        }
      };

      await this.setStorageData(storageData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to store FastGPT config: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Retrieve FastGPT configuration with decrypted API key
   */
  async getFastGPTConfig(): Promise<StorageResult<FastGPTConfig | null>> {
    try {
      const result = await this.getStorageData(['fastgptConfig']);
      
      if (!result.fastgptConfig) {
        return { success: true, data: null };
      }

      const decryptedApiKey = await this.encryptionService.decrypt(result.fastgptConfig.apiKey);
      
      const config: FastGPTConfig = {
        baseUrl: result.fastgptConfig.baseUrl,
        appId: result.fastgptConfig.appId,
        apiKey: decryptedApiKey
      };

      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve FastGPT config: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Store extension setup state
   */
  async setSetupState(onboardingComplete: boolean, configurationComplete: boolean): Promise<StorageResult<void>> {
    try {
      const storageData = {
        setupState: {
          onboardingComplete,
          configurationComplete
        }
      };

      await this.setStorageData(storageData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to store setup state: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Retrieve extension setup state
   */
  async getSetupState(): Promise<StorageResult<{ onboardingComplete: boolean; configurationComplete: boolean }>> {
    try {
      const result = await this.getStorageData(['setupState']);
      
      const defaultState = {
        onboardingComplete: false,
        configurationComplete: false
      };

      return {
        success: true,
        data: result.setupState || defaultState
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve setup state: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Store chat session data
   */
  async setChatSession(sessionId: string, session: ChatSession): Promise<StorageResult<void>> {
    try {
      const existingSessions = await this.getChatSessions();
      const sessions = existingSessions.success ? existingSessions.data || {} : {};

      sessions[sessionId] = {
        messages: session.messages,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString()
      };

      const storageData = {
        chatSessions: sessions
      };

      await this.setStorageData(storageData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to store chat session: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Retrieve all chat sessions
   */
  async getChatSessions(): Promise<StorageResult<{ [sessionId: string]: any } | null>> {
    try {
      const result = await this.getStorageData(['chatSessions']);
      return { success: true, data: result.chatSessions || null };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve chat sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Set all chat sessions (for import functionality)
   */
  async setChatSessions(sessions: { [sessionId: string]: any }): Promise<StorageResult<void>> {
    try {
      const storageData = {
        chatSessions: sessions
      };

      await this.setStorageData(storageData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to set chat sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Store user preferences
   */
  async setPreferences(preferences: { theme?: 'light' | 'dark'; streamingEnabled: boolean }): Promise<StorageResult<void>> {
    try {
      const storageData = { preferences };
      await this.setStorageData(storageData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to store preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Retrieve user preferences
   */
  async getPreferences(): Promise<StorageResult<{ theme?: 'light' | 'dark'; streamingEnabled: boolean }>> {
    try {
      const result = await this.getStorageData(['preferences']);
      
      const defaultPreferences = {
        streamingEnabled: true
      };

      return {
        success: true,
        data: result.preferences || defaultPreferences
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get current extension state
   */
  async getExtensionState(): Promise<StorageResult<ExtensionState>> {
    try {
      const setupStateResult = await this.getSetupState();
      const configResult = await this.getFastGPTConfig();

      if (!setupStateResult.success) {
        return { success: false, error: setupStateResult.error };
      }

      const setupState = setupStateResult.data!;
      let currentView: 'onboarding' | 'configuration' | 'chat' = 'onboarding';

      if (setupState.onboardingComplete && !setupState.configurationComplete) {
        currentView = 'configuration';
      } else if (setupState.onboardingComplete && setupState.configurationComplete) {
        currentView = 'chat';
      }

      const state: ExtensionState = {
        setupComplete: setupState.onboardingComplete,
        configurationComplete: setupState.configurationComplete,
        currentView,
        fastgptConfig: configResult.success ? configResult.data || undefined : undefined
      };

      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get extension state: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Clear all stored data
   */
  async clearAllData(): Promise<StorageResult<void>> {
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to clear data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Remove specific data keys
   */
  async removeData(keys: string[]): Promise<StorageResult<void>> {
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove data: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Private helper to set data in Chrome storage
   */
  private async setStorageData(data: Partial<ExtensionStorage>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Private helper to get data from Chrome storage
   */
  private async getStorageData(keys: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }
}