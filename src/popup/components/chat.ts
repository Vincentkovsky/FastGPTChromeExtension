// Chat Interface Component for FastGPT Chrome Extension
import { ExtensionStateManager } from "../../state/stateManager";
import { ChatMessage, ChatSession } from "../../types/storage";
import { FastGPTClient } from "../../api/fastgptClient";
import { ChromeStorageManager } from "../../storage/storage";

export class ChatComponent {
  private stateManager: ExtensionStateManager;
  private storageManager: ChromeStorageManager;
  private fastgptClient: FastGPTClient | null = null;
  private currentSession: ChatSession | null = null;
  private isLoading: boolean = false;
  private isStreaming: boolean = false;

  constructor(stateManager: ExtensionStateManager) {
    this.stateManager = stateManager;
    this.storageManager = new ChromeStorageManager();
  }

  /**
   * Render the chat interface
   */
  async render(container: HTMLElement): Promise<void> {
    // Initialize FastGPT client if not already done
    await this.initializeFastGPTClient();

    // Create the chat interface HTML
    container.innerHTML = this.createChatHTML();

    // Setup event listeners
    this.setupEventListeners(container);

    // Load existing chat session or create new one
    await this.loadOrCreateChatSession();

    // Render existing messages
    this.renderMessages();
  }

  /**
   * Initialize the FastGPT client with current configuration
   */
  private async initializeFastGPTClient(): Promise<void> {
    const config = this.stateManager.getFastGPTConfig();
    if (config) {
      this.fastgptClient = new FastGPTClient(config);
    }
  }

  /**
   * Create the chat interface HTML structure
   */
  private createChatHTML(): string {
    return `
      <div class="chat-container view-container">
        <div class="chat-header">
          <h1 class="chat-title">FastGPT Chat</h1>
          <div class="chat-controls">
            <button class="settings-button" id="settings-button" title="Settings">
              ⋯
            </button>
          </div>
        </div>
        
        <div class="chat-messages" id="chat-messages">
          <!-- Messages will be rendered here -->
        </div>
        
        <div class="chat-input-container">
          <div class="typing-indicator" id="typing-indicator" style="display: none;">
            <span class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span class="typing-text">FastGPT is typing...</span>
          </div>
          
          <div class="chat-input-wrapper">
            <textarea 
              id="message-input" 
              class="message-input" 
              placeholder="Type your message here..."
              rows="1"
            ></textarea>
            <button id="send-button" class="send-button" disabled>
              <span class="send-icon">➤</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners for the chat interface
   */
  private setupEventListeners(container: HTMLElement): void {
    const messageInput = container.querySelector('#message-input') as HTMLTextAreaElement;
    const sendButton = container.querySelector('#send-button') as HTMLButtonElement;
    const settingsButton = container.querySelector('#settings-button') as HTMLButtonElement;

    if (messageInput) {
      // Auto-resize textarea
      messageInput.addEventListener('input', () => {
        this.autoResizeTextarea(messageInput);
        this.updateSendButtonState(messageInput, sendButton);
      });

      // Handle Enter key (send message) and Shift+Enter (new line)
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage(messageInput);
        }
      });

      // Initial button state
      this.updateSendButtonState(messageInput, sendButton);
    }

    if (sendButton) {
      sendButton.addEventListener('click', () => {
        this.handleSendMessage(messageInput);
      });
    }

    if (settingsButton) {
      settingsButton.addEventListener('click', async () => {
        await this.handleSettingsClick();
      });
    }

    // Update message count
    this.updateMessageCount();
  }



  /**
   * Auto-resize textarea based on content
   */
  private autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    const maxHeight = 120; // Maximum height in pixels
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
  }

  /**
   * Update send button state based on input content
   */
  private updateSendButtonState(input: HTMLTextAreaElement, button: HTMLButtonElement): void {
    const hasContent = input.value.trim().length > 0;
    const canSend = hasContent && !this.isLoading && !this.isStreaming;
    
    button.disabled = !canSend;
    button.classList.toggle('active', canSend);
  }

  /**
   * Handle sending a message
   */
  private async handleSendMessage(input: HTMLTextAreaElement): Promise<void> {
    const message = input.value.trim();
    if (!message || this.isLoading || this.isStreaming || !this.fastgptClient) {
      return;
    }

    // Clear input and reset height
    input.value = '';
    input.style.height = 'auto';

    try {
      // Add user message to chat
      const userMessage = this.createMessage('user', message);
      await this.addMessageToSession(userMessage);
      this.renderMessages();

      // Create assistant message for streaming
      const assistantMessage = this.createMessage('assistant', '');
      await this.addMessageToSession(assistantMessage);
      
      // Render messages to show the empty assistant message
      this.renderMessages();
      
      // Start streaming immediately
      this.setStreamingState(true);

      // Stream message from FastGPT
      console.log('Starting stream for message:', message);
      console.log('Assistant message ID:', assistantMessage.id);
      await this.streamMessageResponse(assistantMessage, message);

    } catch (error) {
      console.error('Error sending message:', error);
      await this.showErrorMessage('Failed to send message. Please try again.');
    } finally {
      this.updateSendButtonState(input, document.querySelector('#send-button') as HTMLButtonElement);
    }
  }

  /**
   * Handle settings button click
   */
  private async handleSettingsClick(): Promise<void> {
    // Navigate to settings page
    await this.stateManager.setCurrentView('settings');
    window.dispatchEvent(new CustomEvent('viewChange'));
  }





  /**
   * Set streaming state for the interface
   */
  private setStreamingState(streaming: boolean): void {
    this.isStreaming = streaming;
    const messageInput = document.querySelector('#message-input') as HTMLTextAreaElement;
    const sendButton = document.querySelector('#send-button') as HTMLButtonElement;

    if (messageInput) {
      messageInput.disabled = streaming;
    }

    if (sendButton) {
      this.updateSendButtonState(messageInput, sendButton);
    }


  }

  /**
   * Show or hide typing indicator
   */
  private showTypingIndicator(show: boolean): void {
    const typingIndicator = document.querySelector('#typing-indicator') as HTMLElement;
    if (typingIndicator) {
      typingIndicator.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * Stream message response from FastGPT and update UI in real-time
   */
  private async streamMessageResponse(assistantMessage: ChatMessage, userMessage: string): Promise<void> {
    console.log('streamMessageResponse called with:', { assistantMessage, userMessage });
    
    if (!this.fastgptClient || !this.currentSession) {
      console.error('Missing dependencies:', { 
        fastgptClient: !!this.fastgptClient, 
        currentSession: !!this.currentSession 
      });
      throw new Error('FastGPT client or current session not available');
    }

    let accumulatedContent = '';
    
    try {
      // Get the message element for real-time updates
      const messageElement = document.querySelector(`[data-message-id="${assistantMessage.id}"]`);
      console.log('Found message element:', !!messageElement);
      
      const messageContentElement = messageElement?.querySelector('.message-content') as HTMLElement;
      const messageTextElement = messageElement?.querySelector('.message-text') as HTMLElement;
      
      console.log('Found sub-elements:', { 
        messageContentElement: !!messageContentElement, 
        messageTextElement: !!messageTextElement 
      });
      
      if (!messageTextElement || !messageContentElement) {
        console.error('Message elements not found for ID:', assistantMessage.id);
        throw new Error('Message element not found for streaming updates');
      }

      // Add streaming visual indicators
      messageElement?.classList.add('streaming');
      messageContentElement.classList.add('streaming');

      // Start streaming
      const streamGenerator = this.fastgptClient.sendMessageStream(userMessage, this.currentSession.id);
      
      let chunkCount = 0;
      for await (const chunk of streamGenerator) {
        // Check if streaming was interrupted
        if (!this.isStreaming) {
          console.log('Streaming was interrupted by user');
          break;
        }

        // Accumulate content
        accumulatedContent += chunk;
        chunkCount++;
        
        // Update the message content in real-time
        assistantMessage.content = accumulatedContent;
        messageTextElement.innerHTML = this.formatMessageContent(accumulatedContent);
        
        // Auto-scroll to bottom to follow the streaming content
        this.scrollToBottom();
        
        // Add a small delay to make streaming visible and prevent UI blocking
        if (chunkCount % 5 === 0) { // Only delay every 5 chunks for better performance
          await this.sleep(20);
        }
      }

      // Remove streaming visual indicators
      messageElement?.classList.remove('streaming');
      messageContentElement.classList.remove('streaming');

      // Final update to ensure message is complete
      assistantMessage.content = accumulatedContent;
      assistantMessage.timestamp = new Date();
      
      // Final render to ensure proper formatting
      messageTextElement.innerHTML = this.formatMessageContent(accumulatedContent);
      
      // Save the completed message to storage
      await this.saveChatSession();
      
      console.log(`Streaming completed successfully with ${chunkCount} chunks`);

      // Remove streaming visual indicators
      messageElement?.classList.remove('streaming');
      messageContentElement.classList.remove('streaming');

      // Final update to ensure message is complete
      assistantMessage.content = accumulatedContent;
      assistantMessage.timestamp = new Date();
      
      // Final render to ensure proper formatting
      messageTextElement.innerHTML = this.formatMessageContent(accumulatedContent);
      
      // Save the completed message to storage
      await this.saveChatSession();
      
      console.log(`Streaming completed successfully with ${chunkCount} chunks`);
      
    } catch (error) {
      console.error('Error during streaming:', error);
      
      // Remove streaming visual indicators on error
      const messageElement = document.querySelector(`[data-message-id="${assistantMessage.id}"]`);
      const messageContentElement = messageElement?.querySelector('.message-content') as HTMLElement;
      messageElement?.classList.remove('streaming');
      messageContentElement?.classList.remove('streaming');
      
      // Handle streaming errors gracefully
      if (error instanceof Error) {
        if (error.message.includes('aborted') || error.message.includes('cancelled')) {
          // User cancelled or connection was aborted
          assistantMessage.content = accumulatedContent + '\n\n_[Response was interrupted]_';
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          // Network error during streaming
          assistantMessage.content = accumulatedContent + '\n\n❌ _Connection lost during response. Please try again._';
        } else if (error.message.includes('timeout')) {
          // Timeout error
          assistantMessage.content = accumulatedContent + '\n\n❌ _Request timed out. Please try again._';
        } else {
          // Other streaming errors
          assistantMessage.content = accumulatedContent + '\n\n❌ _An error occurred while receiving the response._';
        }
      } else {
        assistantMessage.content = accumulatedContent + '\n\n❌ _An unexpected error occurred._';
      }
      
      // Update the UI with error message
      const messageTextElement = messageElement?.querySelector('.message-text') as HTMLElement;
      if (messageTextElement) {
        messageTextElement.innerHTML = this.formatMessageContent(assistantMessage.content);
      }
      
      // Save the message with error state
      await this.saveChatSession();
      
      throw error; // Re-throw to be handled by the calling method
    } finally {
      // Always clean up streaming state
      this.setStreamingState(false);
    }
  }

  /**
   * Scroll chat messages to bottom
   */
  private scrollToBottom(): void {
    const messagesContainer = document.querySelector('#chat-messages') as HTMLElement;
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * Sleep for specified milliseconds (for streaming delay)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Show error message in chat
   */
  private async showErrorMessage(message: string): Promise<void> {
    const errorMessage = this.createMessage('assistant', `❌ ${message}`);
    await this.addMessageToSession(errorMessage);
    this.renderMessages();
  }

  /**
   * Create a new chat message
   */
  private createMessage(role: 'user' | 'assistant', content: string): ChatMessage {
    return {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: new Date()
    };
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Load existing chat session or create a new one
   */
  private async loadOrCreateChatSession(): Promise<void> {
    try {
      // Try to load existing chat sessions
      const sessionsResult = await this.storageManager.getChatSessions();
      
      if (sessionsResult.success && sessionsResult.data) {
        // Find the most recent session
        const sessions = sessionsResult.data;
        const sessionIds = Object.keys(sessions);
        
        if (sessionIds.length > 0) {
          // Get the most recently updated session
          const mostRecentSessionId = sessionIds.reduce((latest, current) => {
            const latestUpdated = new Date(sessions[latest].updatedAt);
            const currentUpdated = new Date(sessions[current].updatedAt);
            return currentUpdated > latestUpdated ? current : latest;
          });
          
          const sessionData = sessions[mostRecentSessionId];
          this.currentSession = {
            id: mostRecentSessionId,
            messages: sessionData.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })),
            createdAt: new Date(sessionData.createdAt),
            updatedAt: new Date(sessionData.updatedAt)
          };
          
          console.log(`Loaded existing chat session: ${mostRecentSessionId} with ${this.currentSession.messages.length} messages`);
          return;
        }
      }
      
      // No existing sessions found, create a new one
      await this.createNewChatSession();
      
    } catch (error) {
      console.error('Error loading chat session:', error);
      // Fallback to creating a new session
      await this.createNewChatSession();
    }
  }

  /**
   * Create a new chat session
   */
  private async createNewChatSession(): Promise<void> {
    this.currentSession = {
      id: this.generateSessionId(),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save the new session to storage
    await this.saveChatSession();
    console.log(`Created new chat session: ${this.currentSession.id}`);
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Add message to current session and persist to storage
   */
  private async addMessageToSession(message: ChatMessage): Promise<void> {
    if (this.currentSession) {
      this.currentSession.messages.push(message);
      this.currentSession.updatedAt = new Date();
      
      // Persist the updated session to storage
      await this.saveChatSession();
    }
  }

  /**
   * Save current chat session to storage
   */
  private async saveChatSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      const result = await this.storageManager.setChatSession(this.currentSession.id, this.currentSession);
      if (!result.success) {
        console.error('Failed to save chat session:', result.error);
      }
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }

  /**
   * Render all messages in the chat
   */
  private renderMessages(): void {
    const messagesContainer = document.querySelector('#chat-messages') as HTMLElement;
    if (!messagesContainer || !this.currentSession) {
      return;
    }

    messagesContainer.innerHTML = '';

    if (this.currentSession.messages.length === 0) {
      // Show welcome message
      messagesContainer.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">🤖</div>
          <h3>Welcome to FastGPT!</h3>
          <p>Start a conversation by typing a message below.</p>
        </div>
      `;
      return;
    }

    // Render each message
    this.currentSession.messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      messagesContainer.appendChild(messageElement);
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Update message count
    this.updateMessageCount();
  }

  /**
   * Create a DOM element for a message
   */
  private createMessageElement(message: ChatMessage): HTMLElement {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${message.role}`;
    messageDiv.setAttribute('data-message-id', message.id);

    const timestamp = this.formatTimestamp(message.timestamp);
    
    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="message-text">${this.formatMessageContent(message.content)}</div>
        <div class="message-timestamp">${timestamp}</div>
      </div>
    `;

    return messageDiv;
  }

  /**
   * Format message content with Markdown support
   */
  private formatMessageContent(content: string): string {
    // Handle undefined or null content
    if (!content) {
      return '';
    }

    // Basic Markdown parsing
    let formatted = content;

    // Code blocks (```code```)
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code (`code`)
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold (**text** or __text__)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italic (*text* or _text_)
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Strikethrough (~~text~~)
    formatted = formatted.replace(/~~(.*?)~~/g, '<del>$1</del>');
    
    // Links [text](url)
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Headers (# ## ###)
    formatted = formatted.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    formatted = formatted.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Lists
    // Unordered lists (- or *)
    formatted = formatted.replace(/^[\s]*[-*]\s+(.*)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Ordered lists (1. 2. 3.)
    formatted = formatted.replace(/^[\s]*\d+\.\s+(.*)$/gm, '<li>$1</li>');
    
    // Blockquotes (> text)
    formatted = formatted.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');
    
    // Horizontal rules (--- or ***)
    formatted = formatted.replace(/^(---|\*\*\*)$/gm, '<hr>');
    
    // Convert line breaks to HTML (do this last to preserve other formatting)
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: Date | string): string {
    try {
      // Ensure we have a valid Date object
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Now';
      }
      
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      if (diff < 60000) { // Less than 1 minute
        return 'Just now';
      } else if (diff < 3600000) { // Less than 1 hour
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
      } else if (diff < 86400000) { // Less than 1 day
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Now';
    }
  }





  /**
   * Get all chat sessions for management
   */
  async getAllChatSessions(): Promise<{ [sessionId: string]: ChatSession } | null> {
    try {
      const sessionsResult = await this.storageManager.getChatSessions();
      
      if (sessionsResult.success && sessionsResult.data) {
        const sessions: { [sessionId: string]: ChatSession } = {};
        
        // Convert stored sessions back to ChatSession objects
        Object.entries(sessionsResult.data).forEach(([sessionId, sessionData]) => {
          sessions[sessionId] = {
            id: sessionId,
            messages: sessionData.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })),
            createdAt: new Date(sessionData.createdAt),
            updatedAt: new Date(sessionData.updatedAt)
          };
        });
        
        return sessions;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      return null;
    }
  }

  /**
   * Load a specific chat session by ID
   */
  async loadChatSession(sessionId: string): Promise<boolean> {
    try {
      const sessionsResult = await this.storageManager.getChatSessions();
      
      if (sessionsResult.success && sessionsResult.data && sessionsResult.data[sessionId]) {
        const sessionData = sessionsResult.data[sessionId];
        
        this.currentSession = {
          id: sessionId,
          messages: sessionData.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })),
          createdAt: new Date(sessionData.createdAt),
          updatedAt: new Date(sessionData.updatedAt)
        };
        
        // Re-render the messages
        this.renderMessages();
        
        console.log(`Loaded chat session: ${sessionId} with ${this.currentSession.messages.length} messages`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error loading chat session:', error);
      return false;
    }
  }

  /**
   * Update the message count display
   */
  private updateMessageCount(): void {
    const messageCountElement = document.querySelector('#message-count') as HTMLElement;
    if (messageCountElement && this.currentSession) {
      const count = this.currentSession.messages.length;
      messageCountElement.textContent = `${count} message${count !== 1 ? 's' : ''}`;
    }
  }










}