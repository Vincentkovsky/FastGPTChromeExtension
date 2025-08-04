import { ExtensionState, FastGPTConfig, StorageResult } from '../types/storage';
import { ChromeStorageManager } from '../storage/storage';

/**
 * State Manager for Chrome Extension Phases
 * Manages the extension's state transitions between onboarding, configuration, and chat phases
 */
export class ExtensionStateManager {
  private storageManager: ChromeStorageManager;
  private currentState: ExtensionState | null = null;
  private stateChangeListeners: ((state: ExtensionState) => void)[] = [];

  constructor(storageManager?: ChromeStorageManager) {
    this.storageManager = storageManager || new ChromeStorageManager();
  }

  /**
   * Initialize the state manager and load current state
   */
  async initialize(): Promise<StorageResult<ExtensionState>> {
    const result = await this.loadState();
    if (result.success && result.data) {
      this.currentState = result.data;
    }
    return result;
  }

  /**
   * Get the current extension state
   */
  getCurrentState(): ExtensionState | null {
    return this.currentState;
  }

  /**
   * Load state from storage
   */
  async loadState(): Promise<StorageResult<ExtensionState>> {
    try {
      const result = await this.storageManager.getExtensionState();
      if (result.success && result.data) {
        this.currentState = result.data;
        this.notifyStateChange(result.data);
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to load state: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Complete the onboarding phase
   */
  async completeOnboarding(): Promise<StorageResult<ExtensionState>> {
    try {
      const currentSetupState = await this.storageManager.getSetupState();
      if (!currentSetupState.success) {
        return { success: false, error: currentSetupState.error };
      }

      const setupState = currentSetupState.data!;
      const result = await this.storageManager.setSetupState(true, setupState.configurationComplete);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return await this.refreshState();
    } catch (error) {
      return {
        success: false,
        error: `Failed to complete onboarding: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Complete the configuration phase
   */
  async completeConfiguration(config: FastGPTConfig): Promise<StorageResult<ExtensionState>> {
    try {
      // Save the configuration
      const configResult = await this.storageManager.setFastGPTConfig(config);
      if (!configResult.success) {
        return { success: false, error: configResult.error };
      }

      // Update setup state
      const currentSetupState = await this.storageManager.getSetupState();
      if (!currentSetupState.success) {
        return { success: false, error: currentSetupState.error };
      }

      const setupState = currentSetupState.data!;
      const setupResult = await this.storageManager.setSetupState(setupState.onboardingComplete, true);
      
      if (!setupResult.success) {
        return { success: false, error: setupResult.error };
      }

      return await this.refreshState();
    } catch (error) {
      return {
        success: false,
        error: `Failed to complete configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Reset onboarding state
   */
  async resetOnboarding(): Promise<StorageResult<ExtensionState>> {
    try {
      const currentSetupState = await this.storageManager.getSetupState();
      if (!currentSetupState.success) {
        return { success: false, error: currentSetupState.error };
      }

      const setupState = currentSetupState.data!;
      const result = await this.storageManager.setSetupState(false, setupState.configurationComplete);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return await this.refreshState();
    } catch (error) {
      return {
        success: false,
        error: `Failed to reset onboarding: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Reset configuration state
   */
  async resetConfiguration(): Promise<StorageResult<ExtensionState>> {
    try {
      // Remove configuration data
      const removeResult = await this.storageManager.removeData(['fastgptConfig']);
      if (!removeResult.success) {
        return { success: false, error: removeResult.error };
      }

      // Update setup state
      const currentSetupState = await this.storageManager.getSetupState();
      if (!currentSetupState.success) {
        return { success: false, error: currentSetupState.error };
      }

      const setupState = currentSetupState.data!;
      const setupResult = await this.storageManager.setSetupState(setupState.onboardingComplete, false);
      
      if (!setupResult.success) {
        return { success: false, error: setupResult.error };
      }

      return await this.refreshState();
    } catch (error) {
      return {
        success: false,
        error: `Failed to reset configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Reset all extension state
   */
  async resetAllState(): Promise<StorageResult<ExtensionState>> {
    try {
      const result = await this.storageManager.clearAllData();
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return await this.refreshState();
    } catch (error) {
      return {
        success: false,
        error: `Failed to reset all state: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if the extension is ready for chat
   */
  isReadyForChat(): boolean {
    return this.currentState?.setupComplete === true && 
           this.currentState?.configurationComplete === true;
  }

  /**
   * Check if onboarding is complete
   */
  isOnboardingComplete(): boolean {
    return this.currentState?.setupComplete === true;
  }

  /**
   * Check if configuration is complete
   */
  isConfigurationComplete(): boolean {
    return this.currentState?.configurationComplete === true;
  }

  /**
   * Get the current view that should be displayed
   */
  getCurrentView(): 'onboarding' | 'configuration' | 'chat' | 'settings' {
    return this.currentState?.currentView || 'onboarding';
  }

  /**
   * Add a state change listener
   */
  addStateChangeListener(listener: (state: ExtensionState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * Remove a state change listener
   */
  removeStateChangeListener(listener: (state: ExtensionState) => void): void {
    const index = this.stateChangeListeners.indexOf(listener);
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1);
    }
  }

  /**
   * Validate state transitions
   */
  canTransitionTo(targetView: 'onboarding' | 'configuration' | 'chat' | 'settings'): boolean {
    const currentView = this.getCurrentView();
    
    switch (targetView) {
      case 'onboarding':
        return true; // Can always go back to onboarding
      case 'configuration':
        return this.isOnboardingComplete();
      case 'chat':
        return this.isOnboardingComplete() && this.isConfigurationComplete();
      case 'settings':
        return this.isOnboardingComplete() && this.isConfigurationComplete(); // Settings only available after setup
      default:
        return false;
    }
  }

  /**
   * Force a state transition (for testing purposes)
   */
  async forceTransitionTo(targetView: 'onboarding' | 'configuration' | 'chat' | 'settings'): Promise<StorageResult<ExtensionState>> {
    if (!this.canTransitionTo(targetView)) {
      return {
        success: false,
        error: `Invalid state transition from ${this.getCurrentView()} to ${targetView}`
      };
    }

    // Update the current state view
    if (this.currentState) {
      this.currentState.currentView = targetView;
      this.notifyStateChange(this.currentState);
    }

    return { success: true, data: this.currentState! };
  }

  /**
   * Get FastGPT configuration from current state
   */
  getFastGPTConfig(): FastGPTConfig | null {
    return this.currentState?.fastgptConfig || null;
  }

  /**
   * Set the current view (for navigation)
   */
  async setCurrentView(targetView: 'onboarding' | 'configuration' | 'chat' | 'settings'): Promise<StorageResult<ExtensionState>> {
    if (!this.canTransitionTo(targetView)) {
      return {
        success: false,
        error: `Invalid state transition from ${this.getCurrentView()} to ${targetView}`
      };
    }

    // Update the current state view
    if (this.currentState) {
      this.currentState.currentView = targetView;
      this.notifyStateChange(this.currentState);
    }

    return { success: true, data: this.currentState! };
  }

  /**
   * Set FastGPT configuration
   */
  setFastGPTConfig(config: FastGPTConfig): void {
    if (this.currentState) {
      this.currentState.fastgptConfig = config;
      this.notifyStateChange(this.currentState);
    }
  }

  /**
   * Clear FastGPT configuration
   */
  clearFastGPTConfig(): void {
    if (this.currentState) {
      this.currentState.fastgptConfig = undefined;
      this.notifyStateChange(this.currentState);
    }
  }

  /**
   * Refresh state from storage and notify listeners
   */
  private async refreshState(): Promise<StorageResult<ExtensionState>> {
    const result = await this.storageManager.getExtensionState();
    if (result.success && result.data) {
      this.currentState = result.data;
      this.notifyStateChange(result.data);
    }
    return result;
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyStateChange(state: ExtensionState): void {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }
}

// Export a singleton instance for global use
export const stateManager = new ExtensionStateManager();