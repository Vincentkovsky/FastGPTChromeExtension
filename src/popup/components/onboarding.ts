import { ExtensionStateManager } from '../../state/stateManager';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  actionUrl?: string;
  actionText?: string;
  completed: boolean;
}

export class OnboardingComponent {
  private stateManager: ExtensionStateManager;
  private currentStepIndex: number = 0;
  private steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to FastGPT Extension',
      description: 'This extension connects you to your FastGPT knowledge base directly from your browser. Let\'s get you set up in just a few steps!',
      completed: false
    },
    {
      id: 'visit-fastgpt',
      title: 'Access FastGPT Platform',
      description: 'Choose your preferred FastGPT platform to create an account or sign in. Both platforms offer the same powerful AI capabilities.',
      actionUrl: 'https://fastgpt.io',
      actionText: 'Choose Platform',
      completed: false
    },
    {
      id: 'create-knowledge-base',
      title: 'Create Your Knowledge Base',
      description: 'Upload your documents, PDFs, or text content to create a personalized knowledge base. This will be the source of information for your AI assistant.',
      completed: false
    },
    {
      id: 'create-simple-app',
      title: 'Build Your AI App',
      description: 'Create a simple app in FastGPT that connects to your knowledge base. This app will handle conversations and provide intelligent responses.',
      completed: false
    },
    {
      id: 'get-credentials',
      title: 'Get Your API Credentials',
      description: 'Copy your FastGPT Base URL, App ID, and API Key from your app settings. These credentials will connect the extension to your AI assistant.',
      completed: false
    }
  ];

  constructor(stateManager: ExtensionStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Render the onboarding interface
   */
  async render(container: HTMLElement): Promise<void> {
    console.log('Onboarding render called, current step:', this.currentStepIndex);
    await this.loadProgress();
    console.log('Progress loaded, current step:', this.currentStepIndex);
    container.innerHTML = this.getOnboardingHTML();
    console.log('HTML updated');
    this.attachEventListeners(container);
    console.log('Event listeners attached');
  }

  /**
   * Generate the HTML for the onboarding interface
   */
  private getOnboardingHTML(): string {
    const currentStep = this.steps[this.currentStepIndex];
    const progress = ((this.currentStepIndex + 1) / this.steps.length) * 100;

    return `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <div class="onboarding-container view-container" role="main" aria-labelledby="onboarding-title">
        <header class="navigation-header" role="banner">
          <h1 id="onboarding-title" class="navigation-title">FastGPT Setup</h1>
          <div class="navigation-controls">
            <div class="view-state-indicator onboarding" aria-label="Current view: Setup">Setup</div>
          </div>
        </header>
        
        <div class="onboarding-header">
          <div class="progress-bar" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Setup progress">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="step-counter" aria-live="polite">Step ${this.currentStepIndex + 1} of ${this.steps.length}</div>
        </div>

        <main id="main-content" class="onboarding-content" tabindex="-1">
          <div class="step-icon" aria-hidden="true">
            ${this.getStepIcon(currentStep.id)}
          </div>
          
          <h2 class="step-title" id="step-title">${currentStep.title}</h2>
          <p class="step-description" id="step-description">${currentStep.description}</p>

          ${currentStep.actionUrl ? `
            <div class="step-action">
              <button class="action-button focusable" data-url="${currentStep.actionUrl}" 
                      aria-describedby="step-description"
                      title="Opens ${currentStep.actionUrl} in a new tab">
                ${currentStep.actionText || 'Open Link'}
                <span class="sr-only"> (opens in new tab)</span>
              </button>
            </div>
          ` : ''}

          ${this.getStepSpecificContent(currentStep.id)}
        </main>

        <nav class="onboarding-navigation" role="navigation" aria-label="Setup navigation">
          <button class="nav-button secondary focusable" id="prev-button" 
                  ${this.currentStepIndex === 0 ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}
                  aria-label="Go to previous step"
                  title="Previous step">
            <span aria-hidden="true">←</span> Previous
          </button>
          
          <div class="nav-buttons-right">
            ${this.currentStepIndex === this.steps.length - 1 ? `
              <button class="nav-button primary focusable" id="complete-button"
                      aria-label="Complete setup and proceed to configuration"
                      title="Complete setup">
                Complete Setup
              </button>
            ` : `
              <button class="nav-button secondary focusable" id="skip-button"
                      aria-label="Skip remaining steps and go to configuration"
                      title="Skip to configuration">
                Skip to Configuration
              </button>
              <button class="nav-button primary focusable" id="next-button"
                      aria-label="Go to next step"
                      title="Next step">
                Next <span aria-hidden="true">→</span>
              </button>
            `}
          </div>
        </nav>
      </div>
    `;
  }

  /**
   * Get the appropriate icon for each step
   */
  private getStepIcon(stepId: string): string {
    const icons = {
      'welcome': '👋',
      'visit-fastgpt': '🌐',
      'create-knowledge-base': '📚',
      'create-simple-app': '⚡',
      'get-credentials': '🔑'
    };
    return `<span class="step-emoji">${icons[stepId as keyof typeof icons] || '📋'}</span>`;
  }

  /**
   * Get step-specific content and guidance
   */
  private getStepSpecificContent(stepId: string): string {
    switch (stepId) {
      case 'welcome':
        return `
          <div class="step-details">
            <div class="feature-list">
              <ul>
                <li>🤖 AI-powered responses from your knowledge base</li>
                <li>🔒 Secure, private conversations</li>
                <li>⚡ Quick access from any webpage</li>
              </ul>
            </div>
          </div>
        `;

      case 'visit-fastgpt':
        return `
          <div class="platform-options">
            <p class="platform-note">Choose your preferred FastGPT platform:</p>
            <div class="platform-buttons" role="group" aria-label="FastGPT platform options">
              <button class="platform-button focusable" data-url="https://fastgpt.io"
                      aria-label="Visit FastGPT.io global platform"
                      title="Opens FastGPT.io in a new tab">
                <div class="platform-info">
                  <strong>FastGPT.io</strong>
                  <span>Global platform</span>
                </div>
                <span class="sr-only"> (opens in new tab)</span>
              </button>
              <button class="platform-button focusable" data-url="https://fastgpt.cn"
                      aria-label="Visit FastGPT.cn China platform"
                      title="Opens FastGPT.cn in a new tab">
                <div class="platform-info">
                  <strong>FastGPT.cn</strong>
                  <span>China platform</span>
                </div>
                <span class="sr-only"> (opens in new tab)</span>
              </button>
            </div>
          </div>
        `;

      case 'create-knowledge-base':
        return `
          <div class="step-instructions">
            <ol>
              <li>Navigate to "Dataset" in FastGPT</li>
              <li>Click "Create New"</li>
              <li>Upload your documents (PDF, TXT, DOCX, etc.)</li>
              <li>Wait for processing to complete</li>
            </ol>
          </div>
        `;

      case 'create-simple-app':
        return `
          <div class="step-instructions">
            <ol>
              <li>Go to "Studio" section in FastGPT</li>
              <li>Click "Team" and choose "Simple App"</li>
              <li>Connect it to your knowledge base</li>
              <li>Configure and publish your app</li>
            </ol>
          </div>
        `;

      case 'get-credentials':
        return `
          <div class="step-instructions">
            <ol>
              <li>Choose the app in Studio and Click</li>
              <li>Go to "Publish"tab</li>
              <li>Click "API Request"</li>
              <li>Click "Create New"</li>
              <li>Copy API Base URL, App ID, and API Key</li>
            </ol>
            <div class="warning-box">
              <strong>⚠️</strong> Keep your API key secure!
            </div>
          </div>
        `;

      default:
        return '';
    }
  }

  /**
   * Attach event listeners to the onboarding interface
   */
  private attachEventListeners(container: HTMLElement): void {
    console.log('Attaching event listeners...');
    
    // Add keyboard navigation support
    this.setupKeyboardNavigation(container);
    
    // Previous button
    const prevButton = container.querySelector('#prev-button') as HTMLButtonElement;
    console.log('Previous button found:', !!prevButton);
    if (prevButton) {
      prevButton.addEventListener('click', async () => {
        console.log('Previous button clicked');
        await this.goToPreviousStep(container);
      });
      
      // Keyboard support
      prevButton.addEventListener('keydown', async (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          await this.goToPreviousStep(container);
        }
      });
    }

    // Next button
    const nextButton = container.querySelector('#next-button') as HTMLButtonElement;
    console.log('Next button found:', !!nextButton);
    if (nextButton) {
      nextButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Next button clicked');
        this.goToNextStep(container).catch(error => {
          console.error('Error in goToNextStep:', error);
        });
      });
      
      // Keyboard support
      nextButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.goToNextStep(container).catch(error => {
            console.error('Error in goToNextStep:', error);
          });
        }
      });
    }

    // Skip button
    const skipButton = container.querySelector('#skip-button') as HTMLButtonElement;
    if (skipButton) {
      skipButton.addEventListener('click', async () => {
        console.log('Skip button clicked');
        await this.completeOnboarding();
      });
      
      // Keyboard support
      skipButton.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          await this.completeOnboarding();
        }
      });
    }

    // Complete button
    const completeButton = container.querySelector('#complete-button') as HTMLButtonElement;
    if (completeButton) {
      completeButton.addEventListener('click', async () => await this.completeOnboarding());
      
      // Keyboard support
      completeButton.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          await this.completeOnboarding();
        }
      });
    }

    // Action buttons (external links)
    const actionButtons = container.querySelectorAll('.action-button, .platform-button');
    actionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const url = (e.target as HTMLElement).getAttribute('data-url');
        if (url) {
          this.openExternalLink(url);
          this.markCurrentStepCompleted();
        }
      });
      
      // Keyboard support for action buttons
      button.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          e.preventDefault();
          const url = (e.target as HTMLElement).getAttribute('data-url');
          if (url) {
            this.openExternalLink(url);
            this.markCurrentStepCompleted();
          }
        }
      });
    });

    // Focus management - focus main content when rendered
    const mainContent = container.querySelector('#main-content') as HTMLElement;
    if (mainContent) {
      // Announce step change to screen readers
      const stepTitle = container.querySelector('#step-title') as HTMLElement;
      if (stepTitle) {
        stepTitle.setAttribute('aria-live', 'polite');
      }
    }
  }

  /**
   * Setup keyboard navigation for the onboarding interface
   */
  private setupKeyboardNavigation(container: HTMLElement): void {
    // Global keyboard shortcuts
    container.addEventListener('keydown', async (e) => {
      // Don't interfere with form inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          // Previous step
          e.preventDefault();
          if (this.currentStepIndex > 0) {
            await this.goToPreviousStep(container);
          }
          break;
          
        case 'ArrowRight':
        case 'ArrowDown':
          // Next step
          e.preventDefault();
          if (this.currentStepIndex < this.steps.length - 1) {
            await this.goToNextStep(container);
          }
          break;
          
        case 'Home':
          // Go to first step
          e.preventDefault();
          if (this.currentStepIndex !== 0) {
            this.currentStepIndex = 0;
            this.saveProgress();
            await this.render(container);
          }
          break;
          
        case 'End':
          // Go to last step
          e.preventDefault();
          if (this.currentStepIndex !== this.steps.length - 1) {
            this.currentStepIndex = this.steps.length - 1;
            this.saveProgress();
            await this.render(container);
          }
          break;
          
        case 'Escape':
          // Skip to configuration
          e.preventDefault();
          await this.completeOnboarding();
          break;
      }
    });

    // Tab navigation enhancement
    const focusableElements = container.querySelectorAll('.focusable');
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

    // Add keyboard navigation indicator
    container.classList.add('keyboard-navigation-active');
  }

  /**
   * Go to the previous step
   */
  private async goToPreviousStep(container: HTMLElement): Promise<void> {
    console.log('goToPreviousStep called, current step:', this.currentStepIndex);
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      console.log('Moving to previous step:', this.currentStepIndex);
      // Save progress immediately after updating step
      this.saveProgress();
      await this.render(container);
    } else {
      console.log('Already at first step');
    }
  }

  /**
   * Go to the next step
   */
  private async goToNextStep(container: HTMLElement): Promise<void> {
    console.log('goToNextStep called, current step:', this.currentStepIndex);
    // Always mark the current step as completed when moving to next
    this.markCurrentStepCompleted();
    
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      console.log('Moving to step:', this.currentStepIndex);
      // Save progress immediately after updating step
      this.saveProgress();
      await this.render(container);
    } else {
      console.log('Already at last step');
    }
  }

  /**
   * Go to a specific step
   */
  private async goToStep(stepIndex: number, container: HTMLElement): Promise<void> {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.currentStepIndex = stepIndex;
      await this.render(container);
    }
  }

  /**
   * Mark the current step as completed
   */
  private markCurrentStepCompleted(): void {
    this.steps[this.currentStepIndex].completed = true;
    this.saveProgress();
  }

  /**
   * Save onboarding progress to storage
   */
  private saveProgress(): void {
    const progress = {
      currentStep: this.currentStepIndex,
      completedSteps: this.steps.map(step => step.completed)
    };
    chrome.storage.local.set({ onboardingProgress: progress });
  }

  /**
   * Load onboarding progress from storage
   */
  private async loadProgress(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['onboardingProgress']);
      if (result.onboardingProgress) {
        const progress = result.onboardingProgress;
        this.currentStepIndex = Math.min(progress.currentStep || 0, this.steps.length - 1);
        
        if (progress.completedSteps && Array.isArray(progress.completedSteps)) {
          progress.completedSteps.forEach((completed: boolean, index: number) => {
            if (index < this.steps.length) {
              this.steps[index].completed = completed;
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to load onboarding progress:', error);
    }
  }

  /**
   * Complete the onboarding process
   */
  private async completeOnboarding(): Promise<void> {
    try {
      // Mark all steps as completed when user completes onboarding
      this.steps.forEach(step => step.completed = true);
      this.saveProgress();
      
      const result = await this.stateManager.completeOnboarding();
      
      if (result.success) {
        // Trigger a state change to move to configuration
        window.dispatchEvent(new CustomEvent('onboardingComplete'));
      } else {
        console.error('Failed to complete onboarding:', result.error);
        alert('Failed to complete onboarding. Please try again.');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('An error occurred while completing onboarding.');
    }
  }

  /**
   * Open an external link
   */
  private openExternalLink(url: string): void {
    chrome.tabs.create({ url });
  }

  /**
   * Get the current step progress
   */
  getProgress(): { current: number; total: number; percentage: number } {
    const completed = this.steps.filter(step => step.completed).length;
    return {
      current: completed,
      total: this.steps.length,
      percentage: (completed / this.steps.length) * 100
    };
  }

  /**
   * Check if onboarding is complete
   */
  isComplete(): boolean {
    return this.steps.every(step => step.completed);
  }

  /**
   * Check if all steps are completed
   */
  private isAllStepsCompleted(): boolean {
    return this.steps.every(step => step.completed);
  }

  /**
   * Update step indicators to reflect current completion status
   */
  private updateStepIndicators(container: HTMLElement): void {
    const stepIndicators = container.querySelectorAll('.step-indicator');
    stepIndicators.forEach((indicator, index) => {
      const step = this.steps[index];
      indicator.className = `step-indicator ${index === this.currentStepIndex ? 'active' : ''} ${step.completed ? 'completed' : ''}`;
      indicator.textContent = step.completed ? '✓' : (index + 1).toString();
    });
  }

  /**
   * Reset onboarding progress
   */
  reset(): void {
    this.currentStepIndex = 0;
    this.steps.forEach(step => {
      step.completed = false;
    });
  }
}