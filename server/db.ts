import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.sqlite');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure multi-modal file directories exist
const MEDIA_DIRS = ['images', 'videos', 'audios', 'documents'];
MEDIA_DIRS.forEach(dir => {
  const mediaPath = path.join(process.cwd(), 'data', 'media', dir);
  if (!fs.existsSync(mediaPath)) {
    fs.mkdirSync(mediaPath, { recursive: true });
  }
});

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -2000'); // 2MB cache
db.pragma('temp_store = MEMORY');
db.pragma('foreign_keys = OFF'); // Disable FK enforcement to avoid constraint errors

// Initialize tables
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gemini_keys (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      last_used_at DATETIME,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS personalities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      context TEXT NOT NULL,
      user_id TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(chat_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS bot_logs (
      id TEXT PRIMARY KEY,
      request_payload TEXT,
      response_payload TEXT,
      raw_response TEXT,
      api_key_used TEXT,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      api_key TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- Platform Integrations (Telegram, WhatsApp, Facebook Messenger)
    CREATE TABLE IF NOT EXISTS platform_integrations (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      api_key TEXT,
      api_secret TEXT,
      webhook_url TEXT,
      phone_number TEXT,
      bot_token TEXT,
      page_id TEXT,
      access_token TEXT,
      status TEXT DEFAULT 'inactive',
      proxy_url TEXT,
      user_agent TEXT,
      typing_delay_min INTEGER DEFAULT 500,
      typing_delay_max INTEGER DEFAULT 2000,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- Multi-Modal File Storage Metadata
    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      category TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      platform TEXT,
      chat_id TEXT,
      message_id TEXT,
      processed INTEGER DEFAULT 0,
      extracted_text TEXT,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- Playground History
    CREATE TABLE IF NOT EXISTS playground_history (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      media_ids TEXT,
      platform TEXT DEFAULT 'playground',
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    -- Unified Context Engine (Cross-Platform Memory)
    CREATE TABLE IF NOT EXISTS unified_context (
      id TEXT PRIMARY KEY,
      external_user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      context_summary TEXT,
      file_references TEXT,
      last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(external_user_id, platform, user_id)
    );

    -- User Settings (for dark mode, preferences)
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      dark_mode INTEGER DEFAULT 0,
      typing_simulation INTEGER DEFAULT 1,
      anti_detection INTEGER DEFAULT 1,
      default_personality_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  console.log('Database initialized at:', DB_PATH);
  console.log('Media directories initialized at:', path.join(process.cwd(), 'data', 'media'));
}
