import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { initDb, db } from './db';
import { authenticateUser, generateToken, verifyToken, createUser } from './auth';
import { chatWithGemini } from './gemini';
import { processMedia } from './media';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

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
  const { key } = req.body;
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
  const keys = db.prepare('SELECT count(*) as count FROM gemini_keys WHERE user_id = ? AND status = "active"').get(req.user.id) as any;
  const memories = db.prepare('SELECT count(*) as count FROM memories WHERE user_id = ?').get(req.user.id) as any;
  const errors = db.prepare('SELECT count(*) as count FROM bot_logs WHERE user_id = ? AND (response_payload LIKE "%error%" OR response_payload IS NULL)').get(req.user.id) as any;
  
  res.json({
    totalRequests: logs.count,
    activeKeys: keys.count,
    totalMemories: memories.count,
    errorsToday: errors.count
  });
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