import { EncryptionService } from '../types/storage';

/**
 * Simple encryption service using Web Crypto API
 * For Chrome extensions, we use a combination of the extension ID and a fixed salt
 * to derive an encryption key. This provides basic protection for stored data.
 */
export class ChromeEncryptionService implements EncryptionService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly SALT = 'fastgpt-chrome-ext-salt';

  private async getEncryptionKey(): Promise<CryptoKey> {
    // Use extension ID as part of the key derivation
    const extensionId = chrome.runtime.id || 'default-id';
    const keyMaterial = extensionId + ChromeEncryptionService.SALT;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyMaterial);
    
    // Import the key material
    const importedKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive the actual encryption key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(ChromeEncryptionService.SALT),
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedKey,
      {
        name: ChromeEncryptionService.ALGORITHM,
        length: ChromeEncryptionService.KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      const key = await this.getEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(ChromeEncryptionService.IV_LENGTH));
      
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: ChromeEncryptionService.ALGORITHM,
          iv: iv
        },
        key,
        dataBuffer
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async decrypt(encryptedData: string): Promise<string> {
    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, ChromeEncryptionService.IV_LENGTH);
      const encryptedBuffer = combined.slice(ChromeEncryptionService.IV_LENGTH);

      const key = await this.getEncryptionKey();
      
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: ChromeEncryptionService.ALGORITHM,
          iv: iv
        },
        key,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}