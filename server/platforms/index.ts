// Platform Integrations Index
import { PlatformAdapter, PlatformType, PlatformIntegration, IncomingMessage, OutgoingMessage, HumanBehaviorConfig, simulateTypingDelay, getRandomUserAgent, getRandomDelay } from './types';
import { telegramAdapter, downloadTelegramFile, setTelegramWebhook } from './telegram';
import { whatsappAdapter, downloadWhatsAppMedia, whatsappAntiDetectionDelay, verifyWhatsAppSignature } from './whatsapp';
import { messengerAdapter, markMessageAsSeen, getMessengerUserProfile, verifyMessengerSignature } from './messenger';

// Platform adapter registry
const adapters: Record<PlatformType, PlatformAdapter> = {
  telegram: telegramAdapter,
  whatsapp: whatsappAdapter,
  messenger: messengerAdapter,
};

export function getAdapter(platform: PlatformType): PlatformAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return adapter;
}

// Unified message handler with human-like behavior
export async function handleIncomingMessage(
  integration: PlatformIntegration,
  message: IncomingMessage,
  processCallback: (msg: IncomingMessage) => Promise<string>
): Promise<void> {
  const adapter = getAdapter(integration.platform);

  const behaviorConfig: HumanBehaviorConfig = {
    typingDelayMin: integration.typingDelayMin,
    typingDelayMax: integration.typingDelayMax,
    readingDelayPerChar: 20, // ms per character for "reading"
    randomPauseProbability: 0.15,
    statusUpdateInterval: 4000,
  };

  try {
    // 1. Simulate reading delay
    await simulateTypingDelay(behaviorConfig, message.content.length);

    // 2. Get response from AI
    const response = await processCallback(message);

    // 3. Send typing indicator
    await adapter.sendTypingIndicator(integration, message.chatId);

    // 4. Simulate typing delay based on response length
    await simulateTypingDelay(behaviorConfig, response.length);

    // 5. Send the response
    await adapter.sendMessage(integration, {
      chatId: message.chatId,
      content: response,
      replyToMessageId: message.messageId,
    });

  } catch (error) {
    console.error(`Error handling message on ${integration.platform}:`, error);
    throw error;
  }
}

// Send message with human-like behavior
export async function sendMessageWithBehavior(
  integration: PlatformIntegration,
  message: OutgoingMessage
): Promise<any> {
  const adapter = getAdapter(integration.platform);

  // Send typing indicator first
  await adapter.sendTypingIndicator(integration, message.chatId);

  // Simulate typing delay
  const delay = getRandomDelay(integration.typingDelayMin, integration.typingDelayMax);
  await new Promise(resolve => setTimeout(resolve, delay));

  // Send the actual message
  return adapter.sendMessage(integration, message);
}

// Export types
export type {
  PlatformAdapter,
  PlatformType,
  PlatformIntegration,
  IncomingMessage,
  OutgoingMessage,
  HumanBehaviorConfig,
};

// Export utilities
export {
  getRandomUserAgent,
  getRandomDelay,
  simulateTypingDelay,
  // Telegram
  telegramAdapter,
  downloadTelegramFile,
  setTelegramWebhook,
  // WhatsApp
  whatsappAdapter,
  downloadWhatsAppMedia,
  whatsappAntiDetectionDelay,
  verifyWhatsAppSignature,
  // Messenger
  messengerAdapter,
  markMessageAsSeen,
  getMessengerUserProfile,
  verifyMessengerSignature,
};
