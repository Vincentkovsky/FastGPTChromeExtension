import { ExtensionStateManager } from "../../state/stateManager";
import { FastGPTConfig } from "../../types/storage";
import { FastGPTClient, ConnectionTestResult } from "../../api/fastgptClient";



export class ConfigurationComponent {
  private stateManager: ExtensionStateManager;
  private container: HTMLElement | null = null;
  private formData: Partial<FastGPTConfig> = {};

  constructor(stateManager: ExtensionStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Render the configuration component
   */
  async render(container: HTMLElement): Promise<void> {
    this.container = container;
    
    // Load existing configuration if available
    await this.loadExistingConfiguration();
    
    this.container.innerHTML = this.getConfigurationHTML();
    this.setupEventListeners();
  }

  /**
   * Load existing configuration from storage
   */
  private async loadExistingConfiguration(): Promise<void> {
    // Ensure state is loaded from storage first
    await this.stateManager.loadState();
    
    const state = this.stateManager.getCurrentState();
    if (state?.fastgptConfig) {
      this.formData = { ...state.fastgptConfig };
    }
  }

  /**
   * Generate the configuration form HTML
   */
  private getConfigurationHTML(): string {
    return `
      <div class="configuration-container view-container">
        <div class="configuration-header">
          <h1 class="configuration-title">Configure FastGPT Connection</h1>
          <p class="configuration-subtitle">
            Enter your FastGPT connection details to start chatting with your knowledge base.
          </p>
        </div>

        <form id="configuration-form" class="configuration-form" novalidate>
          <div class="form-group">
            <label for="baseUrl" class="form-label">
              FastGPT Base URL <span class="required">*</span>
            </label>
            <input
              type="url"
              id="baseUrl"
              name="baseUrl"
              class="form-input"
              placeholder="https://your-fastgpt-instance.com"
              value="${this.formData.baseUrl || ''}"
            />
            <div class="field-help">
              The base URL of your FastGPT instance (e.g., https://fastgpt.io or your self-hosted URL)
            </div>
          </div>

          <div class="form-group">
            <label for="appId" class="form-label">
              App ID <span class="required">*</span>
            </label>
            <input
              type="text"
              id="appId"
              name="appId"
              class="form-input"
              placeholder="Enter your FastGPT App ID"
              value="${this.formData.appId || ''}"
            />
            <div class="field-help">
              The unique identifier for your FastGPT application
            </div>
          </div>

          <div class="form-group">
            <label for="apiKey" class="form-label">
              API Key <span class="required">*</span>
            </label>
            <input
              type="password"
              id="apiKey"
              name="apiKey"
              class="form-input"
              placeholder="Enter your FastGPT API Key"
              value="${this.formData.apiKey || ''}"
            />
            <div class="field-help">
              Your FastGPT API key for authentication (will be stored securely)
            </div>
          </div>

          <div class="form-actions">
            <button type="button" id="test-connection" class="nav-button secondary">
              Test Connection
            </button>
            <button type="submit" id="save-configuration" class="nav-button primary">
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    `;
  }

  /**
   * Setup event listeners for the configuration form
   */
  private setupEventListeners(): void {
    if (!this.container) return;

    const form = this.container.querySelector('#configuration-form') as HTMLFormElement;
    const baseUrlInput = this.container.querySelector('#baseUrl') as HTMLInputElement;
    const appIdInput = this.container.querySelector('#appId') as HTMLInputElement;
    const apiKeyInput = this.container.querySelector('#apiKey') as HTMLInputElement;
    const testButton = this.container.querySelector('#test-connection') as HTMLButtonElement;
    const saveButton = this.container.querySelector('#save-configuration') as HTMLButtonElement;

    // Handle input changes
    [baseUrlInput, appIdInput, apiKeyInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          this.handleInputChange(input);
        });
      }
    });

    // Form submission
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Test connection button
    if (testButton) {
      testButton.addEventListener('click', () => {
        this.handleTestConnection();
      });
    }
  }

  /**
   * Handle input changes and update form data
   */
  private handleInputChange(input: HTMLInputElement): void {
    const fieldName = input.name as keyof FastGPTConfig;
    this.formData[fieldName] = input.value;
  }

  /**
   * Handle form submission
   */
  private async handleFormSubmit(): Promise<void> {
    // Show loading state
    this.setLoadingState(true);

    try {
      // Update form data from current input values
      this.updateFormDataFromInputs();

      // Save configuration using state manager
      const result = await this.stateManager.completeConfiguration(this.formData as FastGPTConfig);
      
      if (result.success) {
        // Configuration saved successfully
        this.showSuccessMessage('Configuration saved successfully! Redirecting to chat...');
        
        // Auto-redirect to chat after a short delay
        setTimeout(async () => {
          await this.stateManager.setCurrentView('chat');
          window.dispatchEvent(new CustomEvent('viewChange'));
        }, 1500);
      } else {
        this.showErrorMessage(result.error || 'Failed to save configuration');
      }
    } catch (error) {
      this.showErrorMessage('An unexpected error occurred while saving configuration');
    } finally {
      this.setLoadingState(false);
    }
  }


  /**
   * Update form data from current input values
   */
  private updateFormDataFromInputs(): void {
    if (!this.container) return;
    
    const baseUrlInput = this.container.querySelector('#baseUrl') as HTMLInputElement;
    const appIdInput = this.container.querySelector('#appId') as HTMLInputElement;
    const apiKeyInput = this.container.querySelector('#apiKey') as HTMLInputElement;
    
    if (baseUrlInput) {
      this.formData.baseUrl = baseUrlInput.value.trim();
    }
    if (appIdInput) {
      this.formData.appId = appIdInput.value.trim();
    }
    if (apiKeyInput) {
      this.formData.apiKey = apiKeyInput.value.trim();
    }
  }

  /**
   * Handle test connection
   */
  private async handleTestConnection(): Promise<void> {
    // Show loading state
    this.setTestingState(true);

    try {
      // Create FastGPT client with current configuration
      const config = this.formData as FastGPTConfig;
      const client = new FastGPTClient(config);
      
      // Test the connection
      const result = await client.testConnection();
      
      if (result.success) {
        this.showSuccessMessage('Connection test successful! Your FastGPT configuration is working correctly.');
      } else {
        // Show user-friendly error message
        const userMessage = this.getUserFriendlyErrorMessage(result.error || 'Connection test failed');
        this.showErrorMessage(userMessage);
      }
    } catch (error) {
      this.showErrorMessage('An unexpected error occurred during connection test. Please try again.');
    } finally {
      this.setTestingState(false);
    }
  }



  /**
   * Set loading state for form submission
   */
  private setLoadingState(loading: boolean): void {
    if (!this.container) return;
    
    const saveButton = this.container.querySelector('#save-configuration') as HTMLButtonElement;
    const testButton = this.container.querySelector('#test-connection') as HTMLButtonElement;
    
    if (saveButton) {
      saveButton.disabled = loading;
      saveButton.textContent = loading ? 'Saving...' : 'Save Configuration';
    }
    
    if (testButton) {
      testButton.disabled = loading;
    }
  }

  /**
   * Set testing state for connection test
   */
  private setTestingState(testing: boolean): void {
    if (!this.container) return;
    
    const testButton = this.container.querySelector('#test-connection') as HTMLButtonElement;
    const saveButton = this.container.querySelector('#save-configuration') as HTMLButtonElement;
    
    if (testButton) {
      testButton.disabled = testing;
      testButton.textContent = testing ? 'Testing...' : 'Test Connection';
    }
    
    if (saveButton) {
      saveButton.disabled = testing;
    }
  }

  /**
   * Get user-friendly error message for connection test failures
   */
  private getUserFriendlyErrorMessage(error: string): string {
    // Check for common error patterns and provide helpful messages
    if (error.includes('Network error') || error.includes('fetch')) {
      return 'Unable to connect to FastGPT server. Please check your internet connection and Base URL.';
    }
    
    if (error.includes('Authentication failed') || error.includes('401')) {
      return 'Authentication failed. Please check your API key and ensure it has the correct permissions.';
    }
    
    if (error.includes('Access forbidden') || error.includes('403')) {
      return 'Access forbidden. Please verify your API key has the necessary permissions for this app.';
    }
    
    if (error.includes('API endpoint not found') || error.includes('404')) {
      return 'API endpoint not found. Please verify your Base URL is correct and includes the full path to your FastGPT instance.';
    }
    
    if (error.includes('Bad request') || error.includes('400')) {
      return 'Invalid configuration. Please check that your App ID and API key are correct.';
    }
    
    if (error.includes('Rate limit') || error.includes('429')) {
      return 'Too many requests. Please wait a moment before testing the connection again.';
    }
    
    if (error.includes('Server error') || error.includes('500') || error.includes('502') || error.includes('503') || error.includes('504')) {
      return 'FastGPT server is temporarily unavailable. Please try again in a few minutes.';
    }
    
    if (error.includes('Base URL') || error.includes('URL')) {
      return 'Invalid Base URL. Please ensure it starts with https:// and points to your FastGPT instance.';
    }
    
    if (error.includes('App ID')) {
      return 'Invalid App ID. Please check that you\'ve entered the correct App ID from your FastGPT application.';
    }
    
    if (error.includes('API Key')) {
      return 'Invalid API Key. Please ensure you\'re using an application-specific API key, not a general key.';
    }
    
    // Return the original error message if no specific pattern matches
    return error || 'Connection test failed. Please check your configuration and try again.';
  }

  /**
   * Show success message
   */
  private showSuccessMessage(message: string): void {
    this.showMessage(message, 'success');
  }

  /**
   * Show error message
   */
  private showErrorMessage(message: string): void {
    this.showMessage(message, 'error');
  }

  /**
   * Show message with specified type
   */
  private showMessage(message: string, type: 'success' | 'error'): void {
    if (!this.container) return;
    
    // Remove existing messages
    const existingMessage = this.container.querySelector('.message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    // Insert message at the top of the form
    const form = this.container.querySelector('.configuration-form');
    if (form) {
      form.insertBefore(messageDiv, form.firstChild);
    }
    
    // Auto-remove success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 3000);
    }
  }

  /**
   * Update existing configuration with new values
   */
  async updateConfiguration(updates: Partial<FastGPTConfig>): Promise<void> {
    // Load current configuration
    await this.loadExistingConfiguration();
    
    // Merge updates with existing configuration
    this.formData = { ...this.formData, ...updates };
    
    // Re-render the form with updated data
    if (this.container) {
      this.container.innerHTML = this.getConfigurationHTML();
      this.setupEventListeners();
    }
  }

  /**
   * Get current form data
   */
  getCurrentConfiguration(): Partial<FastGPTConfig> {
    return { ...this.formData };
  }

  /**
   * Check if configuration has been modified
   */
  async isConfigurationModified(): Promise<boolean> {
    const currentState = this.stateManager.getCurrentState();
    const existingConfig = currentState?.fastgptConfig;
    
    if (!existingConfig && Object.keys(this.formData).length === 0) {
      return false;
    }
    
    if (!existingConfig || Object.keys(this.formData).length === 0) {
      return true;
    }
    
    return (
      this.formData.baseUrl !== existingConfig.baseUrl ||
      this.formData.appId !== existingConfig.appId ||
      this.formData.apiKey !== existingConfig.apiKey
    );
  }
}