import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendGmailSmtpEmail } from './emailService';

interface OTPRecord {
  code: string;
  email: string;
  expiresAt: number;
}

const STORAGE_PREFIX = '@barkadash_otp_';

export class OTPService {
  /**
   * Generates a 6-digit random verification OTP
   */
  public static generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Sends Registration OTP via Gmail SMTP (melgranttravis@gmail.com)
   */
  public static async sendRegistrationOtp(
    email: string,
    userName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const code = this.generateCode();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes valid

      // Store active OTP locally
      const record: OTPRecord = { code, email: email.toLowerCase().trim(), expiresAt };
      await AsyncStorage.setItem(`${STORAGE_PREFIX}${email.toLowerCase().trim()}`, JSON.stringify(record));

      // Send Gmail SMTP Email
      const emailRes = await sendGmailSmtpEmail({
        to: email.trim(),
        subject: `${code} is your Barkadash Registration Code`,
        otpCode: code,
        type: 'registration',
        userName,
      });

      return emailRes;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send OTP email.' };
    }
  }

  /**
   * Sends Password Reset OTP via Gmail SMTP (melgranttravis@gmail.com)
   */
  public static async sendPasswordResetOtp(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const code = this.generateCode();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes valid

      // Store active OTP locally
      const record: OTPRecord = { code, email: email.toLowerCase().trim(), expiresAt };
      await AsyncStorage.setItem(`${STORAGE_PREFIX}${email.toLowerCase().trim()}`, JSON.stringify(record));

      // Send Gmail SMTP Email
      const emailRes = await sendGmailSmtpEmail({
        to: email.trim(),
        subject: `${code} is your Barkadash Password Reset Code`,
        otpCode: code,
        type: 'password_reset',
      });

      return emailRes;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send reset OTP email.' };
    }
  }

  /**
   * Verifies the 6-digit OTP code entered by the user
   */
  public static async verifyOtp(email: string, inputCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_PREFIX}${email.toLowerCase().trim()}`);
      if (!stored) {
        return { success: false, error: 'No active OTP code found. Please request a new code.' };
      }

      const record: OTPRecord = JSON.parse(stored);

      if (Date.now() > record.expiresAt) {
        await AsyncStorage.removeItem(`${STORAGE_PREFIX}${email.toLowerCase().trim()}`);
        return { success: false, error: 'OTP code has expired. Please request a new code.' };
      }

      if (record.code !== inputCode.trim()) {
        return { success: false, error: 'Incorrect verification code. Please check and try again.' };
      }

      // Valid OTP! Clear stored record
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}${email.toLowerCase().trim()}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification error.' };
    }
  }
}
