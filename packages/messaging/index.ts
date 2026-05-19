export interface SendSmsResult {
  messageId?: string;
}

export interface SmsProvider {
  sendSms(to: string, message: string): Promise<SendSmsResult>;
}

export class ConsoleSmsProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<SendSmsResult> {
    const id = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[sms] -> ${to}: ${message} (id=${id})`);
    return { messageId: id };
  }
}

let cached: SmsProvider | null = null;

export const getSmsProvider = (): SmsProvider => {
  if (cached) return cached;
  const kind = process.env.SMS_PROVIDER?.toLowerCase() ?? 'console';
  switch (kind) {
    case 'console':
      cached = new ConsoleSmsProvider();
      return cached;
    default:
      throw new Error(`Unknown SMS_PROVIDER "${kind}". Supported: console.`);
  }
};
