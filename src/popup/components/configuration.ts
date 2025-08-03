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
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <div class="configuration-container view-container" role="main" aria-labelledby="config-title">
        <header class="navigation-header" role="banner">
          <h1 id="config-title" class="navigation-title">Configure FastGPT Connection</h1>
          <div class="navigation-controls">
            <button class="nav-control-button focusable" id="back-to-onboarding-nav"
                    aria-label="Go back to setup"
                    title="Return to setup process">
              <span aria-hidden="true">←</span> Setup
            </button>
            <div class="view-state-indicator configuration" aria-label="Current view: Configuration">Config</div>
          </div>
        </header>
        
        <nav class="breadcrumb-nav" role="navigation" aria-label="Breadcrumb navigation">
          <div class="breadcrumb-item">
            <button class="breadcrumb-link focusable" id="breadcrumb-onboarding"
                    aria-label="Go to setup">Setup</button>
            <span class="breadcrumb-separator" aria-hidden="true">›</span>
          </div>
          <div class="breadcrumb-item">
            <span class="breadcrumb-current" aria-current="page">Configuration</span>
          </div>
        </nav>
        
        <div class="configuration-header">
          <p class="configuration-subtitle" id="config-description">
            Enter your FastGPT connection details to start chatting with your knowledge base.
          </p>
        </div>

        <main id="main-content" tabindex="-1">
          <form id="configuration-form" class="configuration-form" novalidate 
                aria-describedby="config-description" role="form">
            <fieldset>
              <legend class="sr-only">FastGPT Connection Configuration</legend>
              
              <div class="form-group">
                <label for="baseUrl" class="form-label">
                  FastGPT Base URL <span class="required" aria-label="required">*</span>
                </label>
                <input
                  type="url"
                  id="baseUrl"
                  name="baseUrl"
                  class="form-input focusable"
                  placeholder="https://your-fastgpt-instance.com"
                  value="${this.formData.baseUrl || ''}"
                  aria-describedby="baseUrl-help baseUrl-error"
                  aria-required="true"
                  autocomplete="url"
                />
                <div id="baseUrl-help" class="field-help">
                  The base URL of your FastGPT instance (e.g., https://fastgpt.io or your self-hosted URL)
                </div>
                <div id="baseUrl-error" class="field-error" role="alert" aria-live="polite" style="display: none;"></div>
              </div>

              <div class="form-group">
                <label for="appId" class="form-label">
                  App ID <span class="required" aria-label="required">*</span>
                </label>
                <input
                  type="text"
                  id="appId"
                  name="appId"
                  class="form-input focusable"
                  placeholder="Enter your FastGPT App ID"
                  value="${this.formData.appId || ''}"
                  aria-describedby="appId-help appId-error"
                  aria-required="true"
                  autocomplete="off"
                />
                <div id="appId-help" class="field-help">
                  The unique identifier for your FastGPT application
                </div>
                <div id="appId-error" class="field-error" role="alert" aria-live="polite" style="display: none;"></div>
              </div>

              <div class="form-group">
                <label for="apiKey" class="form-label">
                  API Key <span class="required" aria-label="required">*</span>
                </label>
                <input
                  type="password"
                  id="apiKey"
                  name="apiKey"
                  class="form-input focusable"
                  placeholder="Enter your FastGPT API Key"
                  value="${this.formData.apiKey || ''}"
                  aria-describedby="apiKey-help apiKey-error"
                  aria-required="true"
                  autocomplete="current-password"
                />
                <div id="apiKey-help" class="field-help">
                  Your FastGPT API key for authentication (will be stored securely)
                </div>
                <div id="apiKey-error" class="field-error" role="alert" aria-live="polite" style="display: none;"></div>
              </div>

              <div class="form-actions" role="group" aria-label="Configuration actions">
                <button type="button" id="test-connection" class="nav-button secondary focusable"
                        aria-describedby="test-connection-help"
                        title="Test your connection settings">
                  <span aria-hidden="true">🔍</span> Test Connection
                </button>
                <button type="submit" id="save-configuration" class="nav-button primary focusable"
                        aria-describedby="save-configuration-help"
                        title="Save your configuration settings">
                  <span aria-hidden="true">💾</span> Save Configuration
                </button>
              </div>
              
              <div class="sr-only">
                <div id="test-connection-help">Tests the connection to your FastGPT instance with the provided settings</div>
                <div id="save-configuration-help">Saves your configuration and proceeds to the chat interface</div>
              </div>
            </fieldset>
          </form>

          <footer class="configuration-footer">
            <button id="back-to-onboarding" class="nav-button secondary focusable"
                    aria-label="Go back to setup process"
                    title="Return to setup">
              <span aria-hidden="true">←</span> Back to Setup
            </button>
          </footer>
        </main>
      </div>
    `;
  }

  /**
   * Setup event listeners for the configuration form
   */
  private setupEventListeners(): void {
    if (!this.container) return;

    // Add keyboard navigation support
    this.setupKeyboardNavigation();

    const form = this.container.querySelector('#configuration-form') as HTMLFormElement;
    const baseUrlInput = this.container.querySelector('#baseUrl') as HTMLInputElement;
    const appIdInput = this.container.querySelector('#appId') as HTMLInputElement;
    const apiKeyInput = this.container.querySelector('#apiKey') as HTMLInputElement;
    const testButton = this.container.querySelector('#test-connection') as HTMLButtonElement;
    const saveButton = this.container.querySelector('#save-configuration') as HTMLButtonElement;
    const backButton = this.container.querySelector('#back-to-onboarding') as HTMLButtonElement;

    // Handle input changes and validation
    [baseUrlInput, appIdInput, apiKeyInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          this.handleInputChange(input);
          this.validateField(input);
        });
        
        input.addEventListener('blur', () => {
          this.validateField(input);
        });
        
        // Keyboard support for inputs
        input.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.focusNextField(input);
          }
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
      
      // Keyboard support
      testButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleTestConnection();
        }
      });
    }

    // Save button keyboard support
    if (saveButton) {
      saveButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleFormSubmit();
        }
      });
    }

    // Back button
    if (backButton) {
      backButton.addEventListener('click', async () => {
        await this.stateManager.resetOnboarding();
      });
      
      // Keyboard support
      backButton.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          await this.stateManager.resetOnboarding();
        }
      });
    }

    // Navigation controls
    const backToOnboardingNav = this.container.querySelector('#back-to-onboarding-nav') as HTMLButtonElement;
    const breadcrumbOnboarding = this.container.querySelector('#breadcrumb-onboarding') as HTMLElement;

    if (backToOnboardingNav) {
      backToOnboardingNav.addEventListener('click', async () => {
        await this.stateManager.setCurrentView('onboarding');
        window.dispatchEvent(new CustomEvent('viewChange'));
      });
      
      // Keyboard support
      backToOnboardingNav.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          await this.stateManager.setCurrentView('onboarding');
          window.dispatchEvent(new CustomEvent('viewChange'));
        }
      });
    }

    if (breadcrumbOnboarding) {
      breadcrumbOnboarding.addEventListener('click', async () => {
        await this.stateManager.setCurrentView('onboarding');
        window.dispatchEvent(new CustomEvent('viewChange'));
      });
      
      // Keyboard support
      breadcrumbOnboarding.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          await this.stateManager.setCurrentView('onboarding');
          window.dispatchEvent(new CustomEvent('viewChange'));
        }
      });
    }

    // Focus management - focus main content when rendered
    const mainContent = this.container.querySelector('#main-content') as HTMLElement;
    if (mainContent) {
      // Focus first input field
      setTimeout(() => {
        if (baseUrlInput) {
          baseUrlInput.focus();
        }
      }, 100);
    }

    // Add keyboard navigation indicator
    this.container.classList.add('keyboard-navigation-active');
  }

  /**
   * Setup keyboard navigation for the configuration form
   */
  private setupKeyboardNavigation(): void {
    if (!this.container) return;

    // Global keyboard shortcuts
    this.container.addEventListener('keydown', async (e) => {
      // Don't interfere with form inputs when they have focus
      if (e.target instanceof HTMLInputElement && e.target.type !== 'button') {
        return;
      }
      
      switch (e.key) {
        case 'Escape':
          // Go back to onboarding
          e.preventDefault();
          await this.stateManager.setCurrentView('onboarding');
          window.dispatchEvent(new CustomEvent('viewChange'));
          break;
          
        case 'F5':
          // Test connection (Ctrl+F5 or just F5)
          e.preventDefault();
          this.handleTestConnection();
          break;
          
        case 's':
          // Save configuration (Ctrl+S)
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.handleFormSubmit();
          }
          break;
      }
    });

    // Tab navigation enhancement
    const focusableElements = this.container.querySelectorAll('.focusable');
    focusableElements.forEach((element, index) => {
      element.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Tab') {
          // Let default tab behavior work, but ensure proper focus management
          if (keyEvent.shiftKey && index === 0) {
            // Shift+Tab on first element - focus last element
            e.preventDefault();
            (focusableElements[focusableElements.length - 1] as HTMLElement).focus();
          } else if (!keyEvent.shiftKey && index === focusableElements.length - 1) {
            // Tab on last element - focus first element
            e.preventDefault();
            (focusableElements[0] as HTMLElement).focus();
          }
        }
      });
    });
  }

  /**
   * Focus the next field in the form
   */
  private focusNextField(currentInput: HTMLInputElement): void {
    const inputs = ['baseUrl', 'appId', 'apiKey'];
    const currentIndex = inputs.indexOf(currentInput.id);
    
    if (currentIndex < inputs.length - 1) {
      const nextInput = this.container?.querySelector(`#${inputs[currentIndex + 1]}`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    } else {
      // Focus test connection button
      const testButton = this.container?.querySelector('#test-connection') as HTMLButtonElement;
      if (testButton) {
        testButton.focus();
      }
    }
  }

  /**
   * Validate a form field and show appropriate feedback
   */
  private validateField(input: HTMLInputElement): void {
    const fieldName = input.name;
    const value = input.value.trim();
    const errorElement = this.container?.querySelector(`#${fieldName}-error`) as HTMLElement;
    
    if (!errorElement) return;

    let errorMessage = '';
    let isValid = true;

    // Reset previous error state
    input.classList.remove('error');
    errorElement.style.display = 'none';
    errorElement.textContent = '';

    // Validate based on field type
    switch (fieldName) {
      case 'baseUrl':
        if (!value) {
          errorMessage = 'Base URL is required';
          isValid = false;
        } else if (!this.isValidUrl(value)) {
          errorMessage = 'Please enter a valid URL starting with https://';
          isValid = false;
        }
        break;
        
      case 'appId':
        if (!value) {
          errorMessage = 'App ID is required';
          isValid = false;
        } else if (value.length < 3) {
          errorMessage = 'App ID must be at least 3 characters long';
          isValid = false;
        }
        break;
        
      case 'apiKey':
        if (!value) {
          errorMessage = 'API Key is required';
          isValid = false;
        } else if (value.length < 10) {
          errorMessage = 'API Key appears to be too short';
          isValid = false;
        }
        break;
    }

    // Show error if validation failed
    if (!isValid) {
      input.classList.add('error');
      errorElement.textContent = errorMessage;
      errorElement.style.display = 'block';
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.setAttribute('aria-invalid', 'false');
    }
  }

  /**
   * Check if a string is a valid URL
   */
  private isValidUrl(string: string): boolean {
    try {
      const url = new URL(string);
      return url.protocol === 'https:';
    } catch {
      return false;
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
      // Save configuration
      const result = await this.stateManager.completeConfiguration(this.formData as FastGPTConfig);
      
      if (result.success) {
        // Configuration saved successfully
        this.showSuccessMessage('Configuration saved successfully!');
      } else {
        this.showErrorMessage(result.error || 'Failed to save configuration');
      }
    } catch (error) {
      this.showErrorMessage('An unexpected error occurred while saving configuration');
      console.error('Configuration save error:', error);
    } finally {
      this.setLoadingState(false);
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
        
        // Log detailed error for debugging
        console.error('Connection test failed:', {
          error: result.error,
          details: result.details,
          config: {
            baseUrl: config.baseUrl,
            appId: config.appId,
            // Don't log the API key for security
            hasApiKey: !!config.apiKey
          }
        });
      }
    } catch (error) {
      this.showErrorMessage('An unexpected error occurred during connection test. Please try again.');
      console.error('Connection test error:', error);
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