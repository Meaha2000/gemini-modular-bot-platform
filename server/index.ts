import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { initDb, db } from './db';
import { authenticateUser, generateToken, verifyToken, createUser } from './auth';
import { chatWithGemini } from './gemini';
import { processMedia } from './media';
import { 
  getAdapter, 
  handleIncomingMessage, 
  sendMessageWithBehavior,
  PlatformIntegration,
  IncomingMessage,
  getRandomUserAgent 
} from './platforms';
import {
  saveFile,
  getFileById,
  listFilesByCategory,
  listAllFiles,
  deleteFile,
  readFileContent,
  getFileStats,
} from './fileStorage';
import {
  getOrCreateUnifiedContext,
  updateContextSummary,
  addFileReference,
  getRecentContexts,
  savePlaygroundMessage,
  getPlaygroundHistory,
  getPlaygroundSessions,
  deletePlaygroundSession,
  clearPlaygroundHistory,
  getUserSettings,
  updateUserSettings,
} from './unifiedContext';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/json' })); // For webhook signature verification

// Serve static files from the React app
app.use(express.static(path.join(process.cwd(), 'dist')));

// Initialize Database
initDb();

// Seed initial admin user if none exists
const adminExists = db.prepare('SELECT count(*) as count FROM users').get() as any;
if (adminExists.count === 0) {
  createUser('admin', 'admin123').then(() => {
    console.log('Default admin user created: admin / admin123');
  });
}

// Middleware: Auth
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  
  req.user = user;
  next();
};

// --- AUTHROUTES ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await authenticateUser(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const token = generateToken(user);
  res.json({ token, user });
});

app.get('/api/auth/me', authMiddleware, (req: any, res) => {
  res.json({ user: req.user });
});

// --- BOT ROUTES ---
app.post('/api/bot/chat', authMiddleware, upload.array('files'), async (req: any, res) => {
  try {
    const { prompt, chatId } = req.body;
    const files = req.files as Express.Multer.File[];
    
    const processedMedia = [];
    if (files) {
      for (const file of files) {
        const processed = await processMedia(file.buffer, file.mimetype);
        processedMedia.push(processed);
      }
    }
    
    const result = await chatWithGemini(req.user.id, chatId || 'default', prompt, processedMedia);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bot/clear-memory', authMiddleware, (req: any, res) => {
  const { chatId } = req.body;
  db.prepare('DELETE FROM memories WHERE user_id = ? AND chat_id = ?').run(req.user.id, chatId);
  res.json({ success: true });
});

// --- LOGS ---
app.get('/api/logs', authMiddleware, (req: any, res) => {
  const logs = db.prepare('SELECT * FROM bot_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json(logs);
});

// --- KEYS ---
app.get('/api/keys', authMiddleware, (req: any, res) => {
  const keys = db.prepare('SELECT * FROM gemini_keys WHERE user_id = ?').all(req.user.id);
  res.json(keys);
});

app.post('/api/keys', authMiddleware, (req: any, res) => {
  const key = req.body?.key;
  if (!key) {
    return res.status(400).json({ error: 'API key is required' });
  }
  const id = uuidv4();
  db.prepare('INSERT INTO gemini_keys (id, key, user_id) VALUES (?, ?, ?)').run(id, key, req.user.id);
  res.json({ id, key });
});

app.delete('/api/keys/:id', authMiddleware, (req: any, res) => {
  db.prepare('DELETE FROM gemini_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// --- PERSONALITIES ---
app.get('/api/personalities', authMiddleware, (req: any, res) => {
  const items = db.prepare('SELECT * FROM personalities WHERE user_id = ?').all(req.user.id);
  res.json(items);
});

app.post('/api/personalities', authMiddleware, (req: any, res) => {
  const { name, systemPrompt } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO personalities (id, name, system_prompt, user_id) VALUES (?, ?, ?, ?)').run(id, name, systemPrompt, req.user.id);
  res.json({ id, name, systemPrompt });
});

app.post('/api/personalities/:id/activate', authMiddleware, (req: any, res) => {
  db.prepare('UPDATE personalities SET is_active = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE personalities SET is_active = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.delete('/api/personalities/:id', authMiddleware, (req: any, res) => {
  db.prepare('DELETE FROM personalities WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// --- TOOLS ---
app.get('/api/tools', authMiddleware, (req: any, res) => {
  const items = db.prepare('SELECT * FROM tools WHERE user_id = ?').all(req.user.id);
  res.json(items);
});

app.post('/api/tools', authMiddleware, (req: any, res) => {
  const { name, endpoint, description } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO tools (id, name, endpoint, description, user_id) VALUES (?, ?, ?, ?, ?)').run(id, name, endpoint, description, req.user.id);
  res.json({ id, name, endpoint });
});

app.post('/api/tools/:id/toggle', authMiddleware, (req: any, res) => {
  const tool = db.prepare('SELECT * FROM tools WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id) as any;
  if (tool) {
    db.prepare('UPDATE tools SET is_active = ? WHERE id = ?').run(tool.is_active ? 0 : 1, req.params.id);
  }
  res.json({ success: true });
});

app.delete('/api/tools/:id', authMiddleware, (req: any, res) => {
  db.prepare('DELETE FROM tools WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// --- STATS ---
app.get('/api/stats', authMiddleware, (req: any, res) => {
  const logs = db.prepare('SELECT count(*) as count FROM bot_logs WHERE user_id = ?').get(req.user.id) as any;
  const keys = db.prepare("SELECT count(*) as count FROM gemini_keys WHERE user_id = ? AND status = 'active'").get(req.user.id) as any;
  const memories = db.prepare('SELECT count(*) as count FROM memories WHERE user_id = ?').get(req.user.id) as any;
  const errors = db.prepare("SELECT count(*) as count FROM bot_logs WHERE user_id = ? AND (response_payload LIKE '%error%' OR response_payload IS NULL)").get(req.user.id) as any;
  
  res.json({
    totalRequests: logs.count,
    activeKeys: keys.count,
    totalMemories: memories.count,
    errorsToday: errors.count
  });
});

// --- PLATFORM INTEGRATIONS ---
app.get('/api/integrations', authMiddleware, (req: any, res) => {
  const items = db.prepare('SELECT * FROM platform_integrations WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(items);
});

app.get('/api/integrations/:platform', authMiddleware, (req: any, res) => {
  const items = db.prepare('SELECT * FROM platform_integrations WHERE platform = ? AND user_id = ? ORDER BY created_at DESC').all(req.params.platform, req.user.id);
  res.json(items);
});

app.post('/api/integrations', authMiddleware, (req: any, res) => {
  const { platform, name, apiKey, apiSecret, webhookUrl, phoneNumber, botToken, pageId, accessToken, proxyUrl, typingDelayMin, typingDelayMax } = req.body;
  const id = uuidv4();
  const userAgent = getRandomUserAgent();
  
  db.prepare(`
    INSERT INTO platform_integrations (id, platform, name, api_key, api_secret, webhook_url, phone_number, bot_token, page_id, access_token, proxy_url, user_agent, typing_delay_min, typing_delay_max, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, platform, name, apiKey || null, apiSecret || null, webhookUrl || null, phoneNumber || null, botToken || null, pageId || null, accessToken || null, proxyUrl || null, userAgent, typingDelayMin || 500, typingDelayMax || 2000, req.user.id);
  
  res.json({ id, platform, name, status: 'inactive' });
});

app.put('/api/integrations/:id', authMiddleware, (req: any, res) => {
  const { name, apiKey, apiSecret, webhookUrl, phoneNumber, botToken, pageId, accessToken, proxyUrl, typingDelayMin, typingDelayMax, status } = req.body;
  
  db.prepare(`
    UPDATE platform_integrations 
    SET name = COALESCE(?, name), api_key = COALESCE(?, api_key), api_secret = COALESCE(?, api_secret), 
        webhook_url = COALESCE(?, webhook_url), phone_number = COALESCE(?, phone_number), 
        bot_token = COALESCE(?, bot_token), page_id = COALESCE(?, page_id), 
        access_token = COALESCE(?, access_token), proxy_url = COALESCE(?, proxy_url),
        typing_delay_min = COALESCE(?, typing_delay_min), typing_delay_max = COALESCE(?, typing_delay_max),
        status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(name, apiKey, apiSecret, webhookUrl, phoneNumber, botToken, pageId, accessToken, proxyUrl, typingDelayMin, typingDelayMax, status, req.params.id, req.user.id);
  
  res.json({ success: true });
});

app.post('/api/integrations/:id/toggle', authMiddleware, (req: any, res) => {
  const integration = db.prepare('SELECT * FROM platform_integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id) as any;
  if (integration) {
    const newStatus = integration.status === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE platform_integrations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, req.params.id);
    res.json({ success: true, status: newStatus });
  } else {
    res.status(404).json({ error: 'Integration not found' });
  }
});

app.delete('/api/integrations/:id', authMiddleware, (req: any, res) => {
  db.prepare('DELETE FROM platform_integrations WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// --- WEBHOOK RECEIVERS ---
app.post('/api/webhooks/telegram/:integrationId', async (req, res) => {
  try {
    const integration = db.prepare('SELECT * FROM platform_integrations WHERE id = ? AND platform = ?').get(req.params.integrationId, 'telegram') as any;
    if (!integration || integration.status !== 'active') {
      return res.status(404).json({ error: 'Integration not found or inactive' });
    }

    console.log('[WEBHOOK] Telegram payload:', JSON.stringify(req.body, null, 2));
    
    const adapter = getAdapter('telegram');
    const message = adapter.parseWebhook(req.body);
    
    if (message) {
      message.integrationId = integration.id;
      // Process message asynchronously
      processIncomingMessage(integration, message).catch(console.error);
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('[WEBHOOK] Telegram error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.post('/api/webhooks/whatsapp/:integrationId', async (req, res) => {
  try {
    const integration = db.prepare('SELECT * FROM platform_integrations WHERE id = ? AND platform = ?').get(req.params.integrationId, 'whatsapp') as any;
    if (!integration || integration.status !== 'active') {
      return res.status(404).json({ error: 'Integration not found or inactive' });
    }

    console.log('[WEBHOOK] WhatsApp payload:', JSON.stringify(req.body, null, 2));
    
    // Handle verification challenge
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
      return res.send(req.query['hub.challenge']);
    }
    
    const adapter = getAdapter('whatsapp');
    const message = adapter.parseWebhook(req.body);
    
    if (message) {
      message.integrationId = integration.id;
      processIncomingMessage(integration, message).catch(console.error);
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('[WEBHOOK] WhatsApp error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.get('/api/webhooks/whatsapp/:integrationId', async (req, res) => {
  // WhatsApp webhook verification
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
    console.log('[WEBHOOK] WhatsApp verification request');
    return res.send(req.query['hub.challenge']);
  }
  res.status(400).send('Invalid verification');
});

app.post('/api/webhooks/messenger/:integrationId', async (req, res) => {
  try {
    const integration = db.prepare('SELECT * FROM platform_integrations WHERE id = ? AND platform = ?').get(req.params.integrationId, 'messenger') as any;
    if (!integration || integration.status !== 'active') {
      return res.status(404).json({ error: 'Integration not found or inactive' });
    }

    console.log('[WEBHOOK] Messenger payload:', JSON.stringify(req.body, null, 2));
    
    const adapter = getAdapter('messenger');
    const message = adapter.parseWebhook(req.body);
    
    if (message) {
      message.integrationId = integration.id;
      processIncomingMessage(integration, message).catch(console.error);
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('[WEBHOOK] Messenger error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.get('/api/webhooks/messenger/:integrationId', async (req, res) => {
  // Messenger webhook verification
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
    console.log('[WEBHOOK] Messenger verification request');
    return res.send(req.query['hub.challenge']);
  }
  res.status(400).send('Invalid verification');
});

// Helper function to process incoming messages
async function processIncomingMessage(integration: any, message: IncomingMessage) {
  try {
    // Get unified context
    const context = getOrCreateUnifiedContext(message.senderId, message.platform, message.chatId, integration.user_id);
    
    // Process with Gemini
    const response = await chatWithGemini(integration.user_id, `${message.platform}-${message.chatId}`, message.content, []);
    
    // Send response with human-like behavior
    const platformIntegration: PlatformIntegration = {
      id: integration.id,
      platform: integration.platform,
      name: integration.name,
      botToken: integration.bot_token,
      accessToken: integration.access_token,
      phoneNumber: integration.phone_number,
      status: integration.status,
      typingDelayMin: integration.typing_delay_min,
      typingDelayMax: integration.typing_delay_max,
      userAgent: integration.user_agent,
      userId: integration.user_id,
      createdAt: integration.created_at,
      updatedAt: integration.updated_at,
    };
    
    await sendMessageWithBehavior(platformIntegration, {
      chatId: message.chatId,
      content: response.response,
      replyToMessageId: message.messageId,
    });
    
    // Update context
    updateContextSummary(message.senderId, message.platform, integration.user_id, response.response.substring(0, 200));
    
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

// --- FILE STORAGE ---
app.get('/api/files', authMiddleware, (req: any, res) => {
  const category = req.query.category as string;
  const files = category ? listFilesByCategory(category, req.user.id) : listAllFiles(req.user.id);
  res.json(files);
});

app.get('/api/files/stats', authMiddleware, (req: any, res) => {
  const stats = getFileStats(req.user.id);
  res.json(stats);
});

app.get('/api/files/:id', authMiddleware, (req: any, res) => {
  const file = getFileById(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json(file);
});

app.get('/api/files/:id/download', authMiddleware, (req: any, res) => {
  const file = getFileById(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  
  const content = readFileContent(req.params.id, req.user.id);
  if (!content) return res.status(404).json({ error: 'File content not found' });
  
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
  res.send(content);
});

app.post('/api/files', authMiddleware, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    
    const result = await saveFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.user.id,
      {
        platform: req.body.platform,
        chatId: req.body.chatId,
        messageId: req.body.messageId,
      }
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/files/:id', authMiddleware, (req: any, res) => {
  const success = deleteFile(req.params.id, req.user.id);
  if (!success) return res.status(404).json({ error: 'File not found' });
  res.json({ success: true });
});

// --- PLAYGROUND HISTORY ---
app.get('/api/playground/sessions', authMiddleware, (req: any, res) => {
  const sessions = getPlaygroundSessions(req.user.id);
  res.json(sessions);
});

app.get('/api/playground/history/:chatId', authMiddleware, (req: any, res) => {
  const history = getPlaygroundHistory(req.params.chatId, req.user.id);
  res.json(history);
});

app.post('/api/playground/message', authMiddleware, (req: any, res) => {
  const { chatId, role, content, mediaIds } = req.body;
  const message = savePlaygroundMessage(chatId, role, content, req.user.id, mediaIds);
  res.json(message);
});

app.delete('/api/playground/session/:chatId', authMiddleware, (req: any, res) => {
  deletePlaygroundSession(req.params.chatId, req.user.id);
  res.json({ success: true });
});

app.delete('/api/playground/history', authMiddleware, (req: any, res) => {
  clearPlaygroundHistory(req.user.id);
  res.json({ success: true });
});

// --- USER SETTINGS ---
app.get('/api/settings/user', authMiddleware, (req: any, res) => {
  const settings = getUserSettings(req.user.id);
  res.json(settings);
});

app.put('/api/settings/user', authMiddleware, (req: any, res) => {
  const { darkMode, typingSimulation, antiDetection, defaultPersonalityId } = req.body;
  updateUserSettings(req.user.id, { darkMode, typingSimulation, antiDetection, defaultPersonalityId });
  res.json({ success: true });
});

// --- UNIFIED CONTEXT ---
app.get('/api/context/recent', authMiddleware, (req: any, res) => {
  const contexts = getRecentContexts(req.user.id);
  res.json(contexts);
});

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});