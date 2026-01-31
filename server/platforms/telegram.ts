// Telegram Platform Adapter
import { PlatformAdapter, PlatformIntegration, IncomingMessage, OutgoingMessage, getRandomUserAgent } from './types';

export const telegramAdapter: PlatformAdapter = {
  platform: 'telegram',

  async sendMessage(integration: PlatformIntegration, message: OutgoingMessage): Promise<any> {
    const url = `https://api.telegram.org/bot${integration.botToken}/sendMessage`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': integration.userAgent || getRandomUserAgent(),
    };

    const body: any = {
      chat_id: message.chatId,
      text: message.content,
      parse_mode: 'Markdown',
    };

    if (message.replyToMessageId) {
      body.reply_to_message_id = message.replyToMessageId;
    }

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    };

    const response = await fetch(url, fetchOptions);
    return response.json();
  },

  async sendTypingIndicator(integration: PlatformIntegration, chatId: string): Promise<void> {
    const url = `https://api.telegram.org/bot${integration.botToken}/sendChatAction`;
    
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': integration.userAgent || getRandomUserAgent(),
      },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing',
      }),
    });
  },

  parseWebhook(payload: any): IncomingMessage | null {
    const message = payload.message || payload.edited_message;
    if (!message) return null;

    const result: IncomingMessage = {
      platform: 'telegram',
      integrationId: '', // Will be set by handler
      chatId: String(message.chat.id),
      messageId: String(message.message_id),
      senderId: String(message.from.id),
      senderName: message.from.first_name || message.from.username,
      content: message.text || message.caption || '',
      timestamp: new Date(message.date * 1000),
      rawPayload: payload,
    };

    // Handle media types
    if (message.photo) {
      result.mediaType = 'image';
      result.mediaUrl = message.photo[message.photo.length - 1].file_id;
    } else if (message.video) {
      result.mediaType = 'video';
      result.mediaUrl = message.video.file_id;
    } else if (message.audio || message.voice) {
      result.mediaType = 'audio';
      result.mediaUrl = (message.audio || message.voice).file_id;
    } else if (message.document) {
      result.mediaType = 'document';
      result.mediaUrl = message.document.file_id;
    } else if (message.sticker) {
      result.mediaType = 'sticker';
      result.mediaUrl = message.sticker.file_id;
    } else if (message.animation) {
      result.mediaType = 'gif';
      result.mediaUrl = message.animation.file_id;
    }

    return result;
  },

  validateWebhook(payload: any, signature?: string): boolean {
    // Telegram doesn't use signatures, but we validate structure
    return payload && (payload.message || payload.edited_message || payload.callback_query);
  },
};

// Helper to download file from Telegram
export async function downloadTelegramFile(
  botToken: string,
  fileId: string
): Promise<{ buffer: Buffer; fileName: string }> {
  // Get file path
  const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const fileInfoRes = await fetch(fileInfoUrl);
  const fileInfo = await fileInfoRes.json();
  
  if (!fileInfo.ok) {
    throw new Error('Failed to get file info from Telegram');
  }

  // Download file
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
  const fileRes = await fetch(fileUrl);
  const arrayBuffer = await fileRes.arrayBuffer();
  
  return {
    buffer: Buffer.from(arrayBuffer),
    fileName: fileInfo.result.file_path.split('/').pop() || 'file',
  };
}

// Set webhook URL for Telegram bot
export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string
): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });
  
  return response.json();
}
