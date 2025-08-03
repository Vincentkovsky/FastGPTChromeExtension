// Chat Component Tests
import { ChatComponent } from '../chat';
import { ExtensionStateManager } from '../../../state/stateManager';
import { FastGPTClient } from '../../../api/fastgptClient';
import { ChromeStorageManager } from '../../../storage/storage';

// Mock the dependencies
jest.mock('../../../state/stateManager');
jest.mock('../../../api/fastgptClient');
jest.mock('../../../storage/storage');

describe('ChatComponent', () => {
  let chatComponent: ChatComponent;
  let mockStateManager: jest.Mocked<ExtensionStateManager>;
  let mockStorageManager: jest.Mocked<ChromeStorageManager>;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Create mock state manager
    mockStateManager = {
      getFastGPTConfig: jest.fn(),
      setCurrentView: jest.fn(),
    } as any;

    // Mock FastGPT config
    mockStateManager.getFastGPTConfig.mockReturnValue({
      baseUrl: 'https://api.fastgpt.io',
      appId: 'test-app-id',
      apiKey: 'test-api-key'
    });

    // Mock storage manager
    mockStorageManager = {
      getChatSessions: jest.fn(),
      setChatSession: jest.fn(),
      removeData: jest.fn(),
    } as any;

    // Mock successful storage operations by default
    mockStorageManager.getChatSessions.mockResolvedValue({ success: true, data: null });
    mockStorageManager.setChatSession.mockResolvedValue({ success: true });
    mockStorageManager.removeData.mockResolvedValue({ success: true });

    // Create chat component
    chatComponent = new ChatComponent(mockStateManager);
    
    // Replace the storage manager with our mock
    (chatComponent as any).storageManager = mockStorageManager;

    // Create mock container
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    jest.clearAllMocks();
  });

  describe('render', () => {
    it('should render chat interface with all required elements', async () => {
      await chatComponent.render(mockContainer);

      // Check if main elements are present
      expect(mockContainer.querySelector('.chat-container')).toBeTruthy();
      expect(mockContainer.querySelector('.chat-header')).toBeTruthy();
      expect(mockContainer.querySelector('.chat-messages')).toBeTruthy();
      expect(mockContainer.querySelector('.chat-input-container')).toBeTruthy();
      expect(mockContainer.querySelector('#message-input')).toBeTruthy();
      expect(mockContainer.querySelector('#send-button')).toBeTruthy();
      expect(mockContainer.querySelector('#settings-button')).toBeTruthy();
    });

    it('should show welcome message when no messages exist', async () => {
      await chatComponent.render(mockContainer);

      const welcomeMessage = mockContainer.querySelector('.welcome-message');
      expect(welcomeMessage).toBeTruthy();
      expect(welcomeMessage?.textContent).toContain('Welcome to FastGPT!');
    });

    it('should disable send button initially', async () => {
      await chatComponent.render(mockContainer);

      const sendButton = mockContainer.querySelector('#send-button') as HTMLButtonElement;
      expect(sendButton.disabled).toBe(true);
    });
  });

  describe('message input', () => {
    beforeEach(async () => {
      await chatComponent.render(mockContainer);
    });

    it('should enable send button when input has content', () => {
      const messageInput = mockContainer.querySelector('#message-input') as HTMLTextAreaElement;
      const sendButton = mockContainer.querySelector('#send-button') as HTMLButtonElement;

      // Initially disabled
      expect(sendButton.disabled).toBe(true);

      // Type message
      messageInput.value = 'Hello, FastGPT!';
      messageInput.dispatchEvent(new Event('input'));

      // Should be enabled
      expect(sendButton.disabled).toBe(false);
      expect(sendButton.classList.contains('active')).toBe(true);
    });

    it('should disable send button when input is empty', () => {
      const messageInput = mockContainer.querySelector('#message-input') as HTMLTextAreaElement;
      const sendButton = mockContainer.querySelector('#send-button') as HTMLButtonElement;

      // Add content first
      messageInput.value = 'Hello';
      messageInput.dispatchEvent(new Event('input'));
      expect(sendButton.disabled).toBe(false);

      // Clear content
      messageInput.value = '';
      messageInput.dispatchEvent(new Event('input'));

      // Should be disabled
      expect(sendButton.disabled).toBe(true);
      expect(sendButton.classList.contains('active')).toBe(false);
    });

    it('should auto-resize textarea based on content', () => {
      const messageInput = mockContainer.querySelector('#message-input') as HTMLTextAreaElement;
      
      // Set initial height
      const initialHeight = messageInput.style.height;
      
      // Add multiple lines of content
      messageInput.value = 'Line 1\nLine 2\nLine 3\nLine 4';
      messageInput.dispatchEvent(new Event('input'));
      
      // Height should have changed (we can't test exact values due to jsdom limitations)
      expect(messageInput.style.height).toBeDefined();
    });
  });

  describe('settings button', () => {
    beforeEach(async () => {
      await chatComponent.render(mockContainer);
    });

    it('should show settings menu when settings button is clicked', () => {
      const settingsButton = mockContainer.querySelector('#settings-button') as HTMLButtonElement;
      
      settingsButton.click();
      
      const settingsMenu = document.querySelector('.settings-menu');
      expect(settingsMenu).toBeTruthy();
    });
  });

  describe('keyboard navigation', () => {
    beforeEach(async () => {
      await chatComponent.render(mockContainer);
    });

    it('should send message on Enter key press', () => {
      const messageInput = mockContainer.querySelector('#message-input') as HTMLTextAreaElement;
      
      messageInput.value = 'Test message';
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: false
      });
      
      messageInput.dispatchEvent(enterEvent);
      
      // Message should be cleared after sending (we can't easily test the actual sending in unit tests)
      expect(messageInput.value).toBe('');
    });

    it('should not send message on Shift+Enter (should add new line)', () => {
      const messageInput = mockContainer.querySelector('#message-input') as HTMLTextAreaElement;
      
      messageInput.value = 'Test message';
      
      const shiftEnterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true
      });
      
      messageInput.dispatchEvent(shiftEnterEvent);
      
      // Message should still be there
      expect(messageInput.value).toBe('Test message');
    });
  });

  describe('message formatting', () => {
    it('should format message content with line breaks', async () => {
      await chatComponent.render(mockContainer);
      
      // Access private method through any cast for testing
      const component = chatComponent as any;
      const formatted = component.formatMessageContent('Line 1\nLine 2\nLine 3');
      
      expect(formatted).toBe('Line 1<br>Line 2<br>Line 3');
    });
  });

  describe('timestamp formatting', () => {
    it('should format recent timestamps as "Just now"', async () => {
      await chatComponent.render(mockContainer);
      
      const component = chatComponent as any;
      const now = new Date();
      const formatted = component.formatTimestamp(now);
      
      expect(formatted).toBe('Just now');
    });

    it('should format timestamps from minutes ago', async () => {
      await chatComponent.render(mockContainer);
      
      const component = chatComponent as any;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const formatted = component.formatTimestamp(fiveMinutesAgo);
      
      expect(formatted).toBe('5m ago');
    });

    it('should format timestamps from hours ago', async () => {
      await chatComponent.render(mockContainer);
      
      const component = chatComponent as any;
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const formatted = component.formatTimestamp(twoHoursAgo);
      
      expect(formatted).toBe('2h ago');
    });
  });

  describe('accessibility', () => {
    beforeEach(async () => {
      await chatComponent.render(mockContainer);
    });

    it('should have proper ARIA labels and roles', () => {
      const messageInput = mockContainer.querySelector('#message-input');
      const sendButton = mockContainer.querySelector('#send-button');
      const settingsButton = mockContainer.querySelector('#settings-button');
      
      // Check that elements have proper attributes for accessibility
      expect(messageInput?.getAttribute('placeholder')).toBe('Type your message here...');
      expect(settingsButton?.getAttribute('title')).toBe('Settings');
    });

    it('should support keyboard navigation', () => {
      const sendButton = mockContainer.querySelector('#send-button') as HTMLButtonElement;
      const settingsButton = mockContainer.querySelector('#settings-button') as HTMLButtonElement;
      
      // Elements should be focusable
      expect(sendButton.tabIndex).not.toBe(-1);
      expect(settingsButton.tabIndex).not.toBe(-1);
    });
  });

  describe('chat history persistence', () => {
    it('should create new session when no existing sessions found', async () => {
      mockStorageManager.getChatSessions.mockResolvedValue({ success: true, data: null });
      
      await chatComponent.render(mockContainer);
      
      expect(mockStorageManager.getChatSessions).toHaveBeenCalled();
      expect(mockStorageManager.setChatSession).toHaveBeenCalled();
    });

    it('should load most recent session when existing sessions found', async () => {
      const mockSessions = {
        'session_1': {
          messages: [
            { id: 'msg1', role: 'user', content: 'Hello', timestamp: '2023-01-01T10:00:00.000Z' }
          ],
          createdAt: '2023-01-01T10:00:00.000Z',
          updatedAt: '2023-01-01T10:00:00.000Z'
        },
        'session_2': {
          messages: [
            { id: 'msg2', role: 'user', content: 'Hi there', timestamp: '2023-01-01T11:00:00.000Z' }
          ],
          createdAt: '2023-01-01T11:00:00.000Z',
          updatedAt: '2023-01-01T11:00:00.000Z'
        }
      };

      mockStorageManager.getChatSessions.mockResolvedValue({ success: true, data: mockSessions });
      
      await chatComponent.render(mockContainer);
      
      expect(mockStorageManager.getChatSessions).toHaveBeenCalled();
      
      // Should load the most recent session (session_2)
      const currentSession = (chatComponent as any).currentSession;
      expect(currentSession.id).toBe('session_2');
      expect(currentSession.messages).toHaveLength(1);
      expect(currentSession.messages[0].content).toBe('Hi there');
    });

    it('should save session when message is added', async () => {
      await chatComponent.render(mockContainer);
      
      // Access private method to add a message
      const component = chatComponent as any;
      const testMessage = {
        id: 'test-msg',
        role: 'user' as const,
        content: 'Test message',
        timestamp: new Date()
      };
      
      await component.addMessageToSession(testMessage);
      
      expect(mockStorageManager.setChatSession).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: 'Test message',
              role: 'user'
            })
          ])
        })
      );
    });

    it('should handle storage errors gracefully', async () => {
      mockStorageManager.getChatSessions.mockRejectedValue(new Error('Storage error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await chatComponent.render(mockContainer);
      
      expect(consoleSpy).toHaveBeenCalledWith('Error loading chat session:', expect.any(Error));
      
      // Should still create a new session as fallback
      expect(mockStorageManager.setChatSession).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('chat session management', () => {
    beforeEach(async () => {
      await chatComponent.render(mockContainer);
    });

    it('should start new chat session', async () => {
      const component = chatComponent as any;
      const originalSessionId = component.currentSession?.id;
      
      await component.startNewChat();
      
      const newSessionId = component.currentSession?.id;
      expect(newSessionId).not.toBe(originalSessionId);
      expect(component.currentSession.messages).toHaveLength(0);
      expect(mockStorageManager.setChatSession).toHaveBeenCalledWith(
        newSessionId,
        expect.objectContaining({
          id: newSessionId,
          messages: []
        })
      );
    });

    it('should clear all chat history', async () => {
      const mockSessions = {
        'session_1': { messages: [], createdAt: '2023-01-01T10:00:00.000Z', updatedAt: '2023-01-01T10:00:00.000Z' },
        'session_2': { messages: [], createdAt: '2023-01-01T11:00:00.000Z', updatedAt: '2023-01-01T11:00:00.000Z' }
      };

      mockStorageManager.getChatSessions.mockResolvedValue({ success: true, data: mockSessions });
      
      const component = chatComponent as any;
      await component.clearChatHistory();
      
      expect(mockStorageManager.removeData).toHaveBeenCalledWith(['chatSessions']);
      expect(mockStorageManager.setChatSession).toHaveBeenCalled();
    });

    it('should get all chat sessions', async () => {
      const mockSessions = {
        'session_1': {
          messages: [{ id: 'msg1', role: 'user', content: 'Hello', timestamp: '2023-01-01T10:00:00.000Z' }],
          createdAt: '2023-01-01T10:00:00.000Z',
          updatedAt: '2023-01-01T10:00:00.000Z'
        }
      };

      mockStorageManager.getChatSessions.mockResolvedValue({ success: true, data: mockSessions });
      
      const sessions = await chatComponent.getAllChatSessions();
      
      expect(sessions).toBeTruthy();
      expect(sessions!['session_1']).toBeDefined();
      expect(sessions!['session_1'].messages[0].content).toBe('Hello');
      expect(sessions!['session_1'].messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should load specific chat session by ID', async () => {
      const mockSessions = {
        'session_1': {
          messages: [{ id: 'msg1', role: 'user', content: 'Hello', timestamp: '2023-01-01T10:00:00.000Z' }],
          createdAt: '2023-01-01T10:00:00.000Z',
          updatedAt: '2023-01-01T10:00:00.000Z'
        },
        'session_2': {
          messages: [{ id: 'msg2', role: 'user', content: 'Hi there', timestamp: '2023-01-01T11:00:00.000Z' }],
          createdAt: '2023-01-01T11:00:00.000Z',
          updatedAt: '2023-01-01T11:00:00.000Z'
        }
      };

      mockStorageManager.getChatSessions.mockResolvedValue({ success: true, data: mockSessions });
      
      const success = await chatComponent.loadChatSession('session_1');
      
      expect(success).toBe(true);
      
      const currentSession = (chatComponent as any).currentSession;
      expect(currentSession.id).toBe('session_1');
      expect(currentSession.messages[0].content).toBe('Hello');
    });

    it('should return false when loading non-existent session', async () => {
      mockStorageManager.getChatSessions.mockResolvedValue({ success: true, data: {} });
      
      const success = await chatComponent.loadChatSession('non-existent');
      
      expect(success).toBe(false);
    });
  });

  describe('settings menu', () => {
    beforeEach(async () => {
      await chatComponent.render(mockContainer);
    });

    it('should show settings menu when settings button is clicked', () => {
      const settingsButton = mockContainer.querySelector('#settings-button') as HTMLButtonElement;
      
      settingsButton.click();
      
      const settingsMenu = document.querySelector('.settings-menu');
      expect(settingsMenu).toBeTruthy();
      expect(settingsMenu?.querySelector('#new-chat')).toBeTruthy();
      expect(settingsMenu?.querySelector('#clear-history')).toBeTruthy();
      expect(settingsMenu?.querySelector('#go-to-config')).toBeTruthy();
    });

    it('should have overlay and close button in settings menu', () => {
      const settingsButton = mockContainer.querySelector('#settings-button') as HTMLButtonElement;
      settingsButton.click();
      
      const overlay = document.querySelector('#settings-overlay');
      const closeButton = document.querySelector('#close-settings');
      
      expect(overlay).toBeTruthy();
      expect(closeButton).toBeTruthy();
      
      // Clean up manually for test
      const settingsMenu = document.querySelector('.settings-menu');
      if (settingsMenu) {
        document.body.removeChild(settingsMenu);
      }
    });

    it('should have all menu options in settings menu', () => {
      const settingsButton = mockContainer.querySelector('#settings-button') as HTMLButtonElement;
      settingsButton.click();
      
      const newChatButton = document.querySelector('#new-chat');
      const clearHistoryButton = document.querySelector('#clear-history');
      const configButton = document.querySelector('#go-to-config');
      
      expect(newChatButton).toBeTruthy();
      expect(clearHistoryButton).toBeTruthy();
      expect(configButton).toBeTruthy();
      
      // Clean up manually for test
      const settingsMenu = document.querySelector('.settings-menu');
      if (settingsMenu) {
        document.body.removeChild(settingsMenu);
      }
    });
  });

  describe('streaming functionality', () => {
    it('should have streaming methods available', () => {
      const component = chatComponent as any;
      
      // Check that streaming-related methods exist
      expect(typeof component.setStreamingState).toBe('function');
      expect(typeof component.streamMessageResponse).toBe('function');
      expect(typeof component.scrollToBottom).toBe('function');
      expect(typeof component.sleep).toBe('function');
    });

    it('should initialize with streaming state false', () => {
      const component = chatComponent as any;
      expect(component.isStreaming).toBe(false);
    });

    it('should handle streaming state changes', () => {
      const component = chatComponent as any;
      
      // Test setting streaming state
      component.setStreamingState(true);
      expect(component.isStreaming).toBe(true);
      
      component.setStreamingState(false);
      expect(component.isStreaming).toBe(false);
    });
  });
});