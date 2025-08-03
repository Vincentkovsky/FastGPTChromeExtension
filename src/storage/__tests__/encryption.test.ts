import { EncryptionService } from '../../types/storage';

// Simple mock encryption service for testing
class MockEncryptionService implements EncryptionService {
  async encrypt(data: string): Promise<string> {
    return `encrypted_${data}`;
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (encryptedData.startsWith('encrypted_')) {
      return encryptedData.replace('encrypted_', '');
    }
    throw new Error('Invalid encrypted data');
  }
}

describe('EncryptionService Interface', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new MockEncryptionService();
  });

  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const testData = 'test-api-key';
      const result = await encryptionService.encrypt(testData);
      
      expect(result).toBe('encrypted_test-api-key');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle different data types', async () => {
      const testCases = ['simple-key', 'complex-key-with-special-chars!@#', ''];
      
      for (const testData of testCases) {
        const result = await encryptionService.encrypt(testData);
        expect(result).toBe(`encrypted_${testData}`);
      }
    });
  });

  describe('decrypt', () => {
    it('should decrypt data successfully', async () => {
      const originalData = 'test-api-key';
      const encryptedData = await encryptionService.encrypt(originalData);
      const decryptedData = await encryptionService.decrypt(encryptedData);
      
      expect(decryptedData).toBe(originalData);
    });

    it('should handle decryption errors', async () => {
      const invalidEncryptedData = 'invalid-data';
      
      await expect(encryptionService.decrypt(invalidEncryptedData))
        .rejects.toThrow('Invalid encrypted data');
    });
  });

  describe('round-trip encryption', () => {
    it('should maintain data integrity through encrypt/decrypt cycle', async () => {
      const testCases = [
        'simple-api-key',
        'complex-key-with-numbers-123',
        'key-with-special-chars!@#$%^&*()',
        'very-long-api-key-that-might-cause-issues-with-some-encryption-algorithms',
        ''
      ];

      for (const originalData of testCases) {
        const encrypted = await encryptionService.encrypt(originalData);
        const decrypted = await encryptionService.decrypt(encrypted);
        
        expect(decrypted).toBe(originalData);
        expect(encrypted).not.toBe(originalData); // Ensure it was actually encrypted
      }
    });
  });
});