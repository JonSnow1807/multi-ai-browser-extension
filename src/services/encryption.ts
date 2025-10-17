import { EncryptedData } from '@/types/storage';

export class EncryptionService {
  private static instance: EncryptionService;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Encrypt text using AES-GCM with a password-derived key
   */
  async encrypt(text: string, password: string): Promise<EncryptedData> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.generateKey(password, salt);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      this.encoder.encode(text)
    );

    return {
      encrypted: this.bufferToBase64(encrypted),
      iv: this.bufferToBase64(iv),
      salt: this.bufferToBase64(salt),
    };
  }

  /**
   * Decrypt data using AES-GCM with a password-derived key
   */
  async decrypt(data: EncryptedData, password: string): Promise<string> {
    const salt = this.base64ToBuffer(data.salt);
    const iv = this.base64ToBuffer(data.iv);
    const encrypted = this.base64ToBuffer(data.encrypted);
    const key = await this.generateKey(password, salt);

    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        encrypted
      );

      return this.decoder.decode(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt: Invalid password or corrupted data');
    }
  }

  /**
   * Generate a cryptographic key from a password using PBKDF2
   */
  async generateKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a SHA-256 hash of the input text
   */
  async hash(text: string): Promise<string> {
    const buffer = await crypto.subtle.digest('SHA-256', this.encoder.encode(text));
    return this.bufferToHex(buffer);
  }

  /**
   * Securely compare two strings in constant time
   */
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Generate a secure random password
   */
  generatePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values)
      .map(x => charset[x % charset.length])
      .join('');
  }

  /**
   * Derive a master key from user's extension password
   */
  async deriveMasterKey(password: string): Promise<CryptoKey> {
    // Use a fixed salt for the master key (stored separately)
    const masterSalt = new Uint8Array([
      77, 97, 115, 116, 101, 114, 83, 97, 108, 116, 50, 48, 50, 52, 33, 33
    ]);
    return this.generateKey(password, masterSalt);
  }

  /**
   * Encrypt API keys with the master key
   */
  async encryptAPIKey(apiKey: string, masterPassword: string): Promise<EncryptedData> {
    // Double encryption for API keys - first with a random key, then with master
    const tempPassword = this.generatePassword();
    const firstEncryption = await this.encrypt(apiKey, tempPassword);

    // Combine temp password and first encryption
    const combined = JSON.stringify({
      tempPassword,
      data: firstEncryption,
    });

    return this.encrypt(combined, masterPassword);
  }

  /**
   * Decrypt API keys with the master key
   */
  async decryptAPIKey(encryptedData: EncryptedData, masterPassword: string): Promise<string> {
    const combined = await this.decrypt(encryptedData, masterPassword);
    const { tempPassword, data } = JSON.parse(combined);
    return this.decrypt(data, tempPassword);
  }

  // Helper methods
  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Validate API key format for different providers
   */
  validateAPIKeyFormat(key: string, provider: string): boolean {
    const patterns: Record<string, RegExp> = {
      claude: /^sk-ant-api03-[\w-]{93,}$/,
      chatgpt: /^sk-[\w]{48,}$/,
      gemini: /^[\w-]{39,}$/,
      grok: /^[\w-]{40,}$/,
    };

    const pattern = patterns[provider];
    return pattern ? pattern.test(key) : true;
  }

  /**
   * Clear sensitive data from memory
   */
  clearSensitiveData(data: any): void {
    if (typeof data === 'string') {
      // Overwrite string in memory (best effort, not guaranteed in JS)
      data = '0'.repeat(data.length);
    } else if (data instanceof Uint8Array) {
      crypto.getRandomValues(data); // Overwrite with random data
      data.fill(0); // Then fill with zeros
    }
  }
}

export default EncryptionService.getInstance();