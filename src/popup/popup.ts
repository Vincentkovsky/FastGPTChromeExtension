// FastGPT Chrome Extension Popup
import { ExtensionStateManager } from "../state/stateManager";
import { OnboardingComponent } from "./components/onboarding";
import { ConfigurationComponent } from "./components/configuration";
import { ChatComponent } from "./components/chat";

class PopupApp {
  private stateManager: ExtensionStateManager;
  private onboardingComponent: OnboardingComponent;
  private configurationComponent: ConfigurationComponent;
  private chatComponent: ChatComponent;
  private appContainer: HTMLElement | null = null;

  constructor() {
    this.stateManager = new ExtensionStateManager();
    this.onboardingComponent = new OnboardingComponent(this.stateManager);
    this.configurationComponent = new ConfigurationComponent(this.stateManager);
    this.chatComponent = new ChatComponent(this.stateManager);
    this.setupEventListeners();
  }

  /**
   * Initialize the popup application
   */
  async initialize(): Promise<void> {
    this.appContainer = document.getElementById("app");
    if (!this.appContainer) {
      console.error("App container not found");
      return;
    }

    try {
      // Initialize state manager
      const stateResult = await this.stateManager.initialize();
      if (!stateResult.success) {
        console.error("Failed to initialize state:", stateResult.error);
        this.showError("Failed to initialize extension state");
        return;
      }

      // Render the appropriate view based on current state
      await this.renderCurrentView();
    } catch (error) {
      console.error("Error initializing popup:", error);
      this.showError("An error occurred while loading the extension");
    }
  }

  /**
   * Render the current view based on extension state
   */
  private async renderCurrentView(): Promise<void> {
    if (!this.appContainer) return;

    const currentView = this.stateManager.getCurrentView();
    
    // Add transition class for smooth view changes
    this.appContainer.classList.add('view-transitioning');

    try {
      switch (currentView) {
        case "onboarding":
          await this.renderOnboardingView();
          break;
        case "configuration":
          await this.renderConfigurationView();
          break;
        case "chat":
          await this.renderChatView();
          break;
        default:
          await this.renderOnboardingView();
      }
    } finally {
      // Remove transition class after a short delay
      setTimeout(() => {
        this.appContainer?.classList.remove('view-transitioning');
      }, 300);
    }
  }

  /**
   * Render the onboarding view
   */
  private async renderOnboardingView(): Promise<void> {
    console.log("Rendering onboarding view");
    if (!this.appContainer) return;
    await this.onboardingComponent.render(this.appContainer);
    console.log("Onboarding view rendered");
  }

  /**
   * Render the configuration view
   */
  private async renderConfigurationView(): Promise<void> {
    console.log("Rendering configuration view");
    if (!this.appContainer) return;
    await this.configurationComponent.render(this.appContainer);
    console.log("Configuration view rendered");
  }

  /**
   * Render the chat view
   */
  private async renderChatView(): Promise<void> {
    console.log("Rendering chat view");
    if (!this.appContainer) return;
    await this.chatComponent.render(this.appContainer);
    console.log("Chat view rendered");
  }

  /**
   * Show an error message
   */
  private showError(message: string): void {
    if (!this.appContainer) return;
    this.appContainer.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <h3>Error</h3>
                <p>${message}</p>
                <button id="retry-button" class="nav-button primary">
                    Retry
                </button>
            </div>
        `;

    // Add retry functionality
    const retryButton = this.appContainer.querySelector("#retry-button");
    if (retryButton) {
      retryButton.addEventListener("click", () => {
        this.initialize();
      });
    }
  }

  /**
   * Setup global event listeners
   */
  private setupEventListeners(): void {
    // Listen for onboarding completion
    window.addEventListener("onboardingComplete", async () => {
      await this.renderCurrentView();
    });

    // Listen for view changes from components
    window.addEventListener("viewChange", async (event: Event) => {
      await this.renderCurrentView();
    });

    // Listen for state changes that affect the current view
    let lastView: string | null = null;
    this.stateManager.addStateChangeListener(async (state) => {
      console.log("State changed:", state);
      
      // Only re-render if the current view has actually changed
      const currentView = this.stateManager.getCurrentView();
      if (currentView !== lastView) {
        lastView = currentView;
        await this.renderCurrentView();
      }
    });
  }
}

// Test if script loads
console.log("FastGPT Extension script loaded!");

// Initialize the popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing popup app");
  const app = new PopupApp();
  app.initialize();
});

// Also try immediate execution
console.log("Script executing immediately");
