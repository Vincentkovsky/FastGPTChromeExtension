// Settings Page Component for FastGPT Chrome Extension
import { ExtensionStateManager } from "../../state/stateManager";
import { ChromeStorageManager } from "../../storage/storage";

export class SettingsComponent {
  private stateManager: ExtensionStateManager;
  private storageManager: ChromeStorageManager;

  constructor(stateManager: ExtensionStateManager) {
    this.stateManager = stateManager;
    this.storageManager = new ChromeStorageManager();
  }

  /**
   * Render the settings page
   */
  async render(container: HTMLElement): Promise<void> {
    container.innerHTML = this.createSettingsHTML();
    this.setupEventListeners(container);
  }

  /**
   * Create the settings page HTML structure
   */
  private createSettingsHTML(): string {
    return `
      <div class="settings-container view-container">
        <div class="settings-header">
          <div class="header-content">
            <button class="back-button" id="back-to-chat" title="Back to Chat">
              ← Back to Chat
            </button>
            <h1 class="settings-title">Settings & Data Management</h1>
          </div>
        </div>
        
        <div class="settings-content">
          <!-- Chat Management Section -->
          <div class="settings-section">
            <div class="section-header">
              <h2 class="section-title">💬 Chat Management</h2>
              <p class="section-description">Manage your chat sessions and conversation history</p>
            </div>
            
            <div class="settings-options">
              <div class="setting-item">
                <div class="setting-info">
                  <h3 class="setting-name">New Chat Session</h3>
                  <p class="setting-description">Start a fresh conversation with FastGPT</p>
                </div>
                <button class="setting-action primary" id="new-chat">
                  New Chat
                </button>
              </div>
              
              <div class="setting-item">
                <div class="setting-info">
                  <h3 class="setting-name">Clear Chat History</h3>
                  <p class="setting-description">Remove all chat messages and sessions</p>
                </div>
                <button class="setting-action danger" id="clear-history">
                  Clear History
                </button>
              </div>
            </div>
          </div>

          <!-- Configuration Section -->
          <div class="settings-section">
            <div class="section-header">
              <h2 class="section-title">⚙️ Configuration</h2>
              <p class="section-description">Manage your FastGPT connection settings</p>
            </div>
            
            <div class="settings-options">
              <div class="setting-item">
                <div class="setting-info">
                  <h3 class="setting-name">Edit Configuration</h3>
                  <p class="setting-description">Update your FastGPT API settings and connection details</p>
                </div>
                <button class="setting-action secondary" id="edit-config">
                  Edit Config
                </button>
              </div>
              
              <div class="setting-item">
                <div class="setting-info">
                  <h3 class="setting-name">Reset Configuration</h3>
                  <p class="setting-description">Clear all configuration settings and start fresh</p>
                </div>
                <button class="setting-action danger" id="reset-config">
                  Reset Config
                </button>
              </div>
            </div>
          </div>

          <!-- Data Management Section -->
          <div class="settings-section">
            <div class="section-header">
              <h2 class="section-title">📊 Data Management</h2>
              <p class="section-description">Import, export, and manage your extension data</p>
            </div>
            
            <div class="settings-options">
              <div class="setting-item">
                <div class="setting-info">
                  <h3 class="setting-name">Export Data</h3>
                  <p class="setting-description">Download your chat history and settings as a backup file</p>
                </div>
                <button class="setting-action secondary" id="export-data">
                  Export Data
                </button>
              </div>
              
              <div class="setting-item">
                <div class="setting-info">
                  <h3 class="setting-name">Import Data</h3>
                  <p class="setting-description">Restore your data from a previously exported backup file</p>
                </div>
                <button class="setting-action secondary" id="import-data">
                  Import Data
                </button>
              </div>
              
              <div class="setting-item danger-item">
                <div class="setting-info">
                  <h3 class="setting-name">Reset All Data</h3>
                  <p class="setting-description">⚠️ Permanently delete all extension data including chats, settings, and configuration</p>
                </div>
                <button class="setting-action danger" id="reset-all">
                  Reset All Data
                </button>
              </div>
            </div>
          </div>

          <!-- Extension Info Section -->
          <div class="settings-section">
            <div class="section-header">
              <h2 class="section-title">ℹ️ Extension Information</h2>
              <p class="section-description">About this FastGPT Chrome Extension</p>
            </div>
            
            <div class="settings-options">
              <div class="info-item">
                <div class="info-row">
                  <span class="info-label">Version:</span>
                  <span class="info-value">1.0.0</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Last Updated:</span>
                  <span class="info-value" id="last-updated">Loading...</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Total Messages:</span>
                  <span class="info-value" id="message-count">Loading...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners for the settings page
   */
  private setupEventListeners(container: HTMLElement): void {
    // Back to chat button
    const backButton = container.querySelector('#back-to-chat') as HTMLButtonElement;
    if (backButton) {
      backButton.addEventListener('click', async () => {
        await this.stateManager.setCurrentView('chat');
        window.dispatchEvent(new CustomEvent('viewChange'));
      });
    }

    // Chat Management
    const newChatButton = container.querySelector('#new-chat') as HTMLButtonElement;
    if (newChatButton) {
      newChatButton.addEventListener('click', async () => {
        await this.handleNewChat();
      });
    }

    const clearHistoryButton = container.querySelector('#clear-history') as HTMLButtonElement;
    if (clearHistoryButton) {
      clearHistoryButton.addEventListener('click', async () => {
        await this.handleClearHistory();
      });
    }

    // Configuration Management
    const editConfigButton = container.querySelector('#edit-config') as HTMLButtonElement;
    if (editConfigButton) {
      editConfigButton.addEventListener('click', async () => {
        await this.stateManager.setCurrentView('configuration');
        window.dispatchEvent(new CustomEvent('viewChange'));
      });
    }

    const resetConfigButton = container.querySelector('#reset-config') as HTMLButtonElement;
    if (resetConfigButton) {
      resetConfigButton.addEventListener('click', async () => {
        await this.handleResetConfig();
      });
    }

    // Data Management
    const exportDataButton = container.querySelector('#export-data') as HTMLButtonElement;
    if (exportDataButton) {
      exportDataButton.addEventListener('click', async () => {
        await this.handleExportData();
      });
    }

    const importDataButton = container.querySelector('#import-data') as HTMLButtonElement;
    if (importDataButton) {
      importDataButton.addEventListener('click', async () => {
        await this.handleImportData();
      });
    }

    const resetAllButton = container.querySelector('#reset-all') as HTMLButtonElement;
    if (resetAllButton) {
      resetAllButton.addEventListener('click', async () => {
        await this.handleResetAllData();
      });
    }

    // Load extension info
    this.loadExtensionInfo();
  }

  /**
   * Handle new chat creation
   */
  private async handleNewChat(): Promise<void> {
    try {
      // Clear current session and go back to chat
      await this.stateManager.setCurrentView('chat');
      window.dispatchEvent(new CustomEvent('viewChange', { 
        detail: { action: 'newChat' } 
      }));
      this.showMessage('New chat session started!', 'success');
    } catch (error) {
      console.error('Error starting new chat:', error);
      this.showMessage('Failed to start new chat. Please try again.', 'error');
    }
  }

  /**
   * Handle clear chat history
   */
  private async handleClearHistory(): Promise<void> {
    if (await this.confirmAction('Clear Chat History', 'Are you sure you want to clear all chat history? This action cannot be undone.')) {
      try {
        const removeResult = await this.storageManager.removeData(['chatSessions']);
        if (removeResult.success) {
          this.showMessage('Chat history cleared successfully!', 'success');
          this.loadExtensionInfo(); // Refresh message count
        } else {
          throw new Error(removeResult.error || 'Failed to clear chat history');
        }
      } catch (error) {
        console.error('Error clearing chat history:', error);
        this.showMessage('Failed to clear chat history. Please try again.', 'error');
      }
    }
  }

  /**
   * Handle reset configuration
   */
  private async handleResetConfig(): Promise<void> {
    if (await this.confirmAction('Reset Configuration', 'Are you sure you want to reset your FastGPT configuration? You will need to reconfigure your connection settings.')) {
      try {
        const removeResult = await this.storageManager.removeData(['fastgptConfig']);
        if (removeResult.success) {
          // Reset state manager
          this.stateManager.clearFastGPTConfig();
          this.showMessage('Configuration reset successfully!', 'success');
        } else {
          throw new Error(removeResult.error || 'Failed to reset configuration');
        }
      } catch (error) {
        console.error('Error resetting configuration:', error);
        this.showMessage('Failed to reset configuration. Please try again.', 'error');
      }
    }
  }

  /**
   * Handle data export
   */
  private async handleExportData(): Promise<void> {
    try {
      // Get all data from storage
      const chatSessionsResult = await this.storageManager.getChatSessions();
      const configResult = await this.storageManager.getFastGPTConfig();
      
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        chatSessions: chatSessionsResult.success ? chatSessionsResult.data : {},
        configuration: configResult.success ? configResult.data : null
      };

      // Create and download file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fastgpt-extension-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showMessage('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showMessage('Failed to export data. Please try again.', 'error');
    }
  }

  /**
   * Handle data import
   */
  private async handleImportData(): Promise<void> {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const importData = JSON.parse(text);
          
          // Validate import data structure
          if (!importData.version || !importData.exportDate) {
            throw new Error('Invalid backup file format');
          }

          if (await this.confirmAction('Import Data', 'This will replace your current data with the imported data. Are you sure you want to continue?')) {
            // Import chat sessions
            if (importData.chatSessions) {
              for (const [sessionId, sessionData] of Object.entries(importData.chatSessions)) {
                await this.storageManager.setChatSession(sessionId, sessionData as any);
              }
            }

            // Import configuration
            if (importData.configuration) {
              await this.storageManager.setFastGPTConfig(importData.configuration);
              this.stateManager.setFastGPTConfig(importData.configuration);
            }

            this.showMessage('Data imported successfully!', 'success');
            this.loadExtensionInfo(); // Refresh stats
          }
        } catch (error) {
          console.error('Error importing data:', error);
          this.showMessage('Failed to import data. Please check the file format.', 'error');
        }
      };

      input.click();
    } catch (error) {
      console.error('Error setting up import:', error);
      this.showMessage('Failed to set up data import. Please try again.', 'error');
    }
  }

  /**
   * Handle reset all data
   */
  private async handleResetAllData(): Promise<void> {
    if (await this.confirmAction('Reset All Data', 'Are you sure you want to reset ALL extension data? This will clear your configuration, chat history, and all settings. This action cannot be undone.', true)) {
      try {
        const removeResult = await this.storageManager.removeData(['chatSessions', 'fastgptConfig', 'onboardingCompleted']);
        if (removeResult.success) {
          // Reset state manager
          this.stateManager.clearFastGPTConfig();
          
          this.showMessage('All data reset successfully! Redirecting to onboarding...', 'success');
          
          // Redirect to onboarding after a short delay
          setTimeout(async () => {
            await this.stateManager.setCurrentView('onboarding');
            window.dispatchEvent(new CustomEvent('viewChange'));
          }, 2000);
        } else {
          throw new Error(removeResult.error || 'Failed to reset all data');
        }
      } catch (error) {
        console.error('Error resetting all data:', error);
        this.showMessage('Failed to reset all data. Please try again.', 'error');
      }
    }
  }

  /**
   * Load and display extension information
   */
  private async loadExtensionInfo(): Promise<void> {
    try {
      // Get last updated time (use current time as placeholder)
      const lastUpdatedElement = document.querySelector('#last-updated') as HTMLElement;
      if (lastUpdatedElement) {
        lastUpdatedElement.textContent = new Date().toLocaleDateString();
      }

      // Get message count
      const messageCountElement = document.querySelector('#message-count') as HTMLElement;
      if (messageCountElement) {
        const sessionsResult = await this.storageManager.getChatSessions();
        let totalMessages = 0;
        
        if (sessionsResult.success && sessionsResult.data) {
          Object.values(sessionsResult.data).forEach((session: any) => {
            totalMessages += session.messages?.length || 0;
          });
        }
        
        messageCountElement.textContent = totalMessages.toString();
      }
    } catch (error) {
      console.error('Error loading extension info:', error);
    }
  }

  /**
   * Show confirmation dialog for destructive actions
   */
  private async confirmAction(title: string, message: string, isDangerous: boolean = false): Promise<boolean> {
    return new Promise((resolve) => {
      const confirmDialog = document.createElement('div');
      confirmDialog.className = 'confirm-dialog-overlay';
      confirmDialog.innerHTML = `
        <div class="confirm-dialog">
          <div class="confirm-header ${isDangerous ? 'danger' : ''}">
            <h3>${title}</h3>
          </div>
          <div class="confirm-body">
            <p>${message}</p>
          </div>
          <div class="confirm-actions">
            <button class="confirm-button secondary" id="confirm-cancel">Cancel</button>
            <button class="confirm-button ${isDangerous ? 'danger' : 'primary'}" id="confirm-ok">
              ${isDangerous ? 'Yes, Delete' : 'Confirm'}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(confirmDialog);

      const cancelButton = confirmDialog.querySelector('#confirm-cancel') as HTMLButtonElement;
      const okButton = confirmDialog.querySelector('#confirm-ok') as HTMLButtonElement;

      const cleanup = () => {
        if (document.body.contains(confirmDialog)) {
          document.body.removeChild(confirmDialog);
        }
      };

      cancelButton.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      okButton.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      // Close on overlay click
      confirmDialog.addEventListener('click', (e) => {
        if (e.target === confirmDialog) {
          cleanup();
          resolve(false);
        }
      });
    });
  }

  /**
   * Show message to user
   */
  private showMessage(message: string, type: 'success' | 'error'): void {
    const messageElement = document.createElement('div');
    messageElement.className = `settings-message ${type}`;
    messageElement.textContent = message;

    const container = document.querySelector('.settings-content');
    if (container) {
      container.insertBefore(messageElement, container.firstChild);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (container.contains(messageElement)) {
          container.removeChild(messageElement);
        }
      }, 5000);
    }
  }
}