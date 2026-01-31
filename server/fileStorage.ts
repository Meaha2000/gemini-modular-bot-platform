// Multi-Modal File Storage System
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';

// Media categories and their extensions
const MEDIA_CATEGORIES: Record<string, string[]> = {
  images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
  videos: ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv'],
  audios: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'opus'],
  documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'json', 'xml'],
};

// Determine category from mime type
export function getCategoryFromMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audios';
  return 'documents';
}

// Get media directory path
export function getMediaPath(category: string): string {
  return path.join(process.cwd(), 'data', 'media', category);
}

// Save file to storage
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: string,
  metadata?: {
    platform?: string;
    chatId?: string;
    messageId?: string;
  }
): Promise<{
  id: string;
  filename: string;
  category: string;
  filePath: string;
  fileSize: number;
}> {
  const category = getCategoryFromMimeType(mimeType);
  const id = uuidv4();
  const ext = originalName.split('.').pop() || mimeType.split('/').pop() || 'bin';
  const filename = `${id}.${ext}`;
  const filePath = path.join(getMediaPath(category), filename);

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(filePath, buffer);

  // Save metadata to database
  db.prepare(`
    INSERT INTO media_files (id, filename, original_name, mime_type, category, file_path, file_size, platform, chat_id, message_id, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    filename,
    originalName,
    mimeType,
    category,
    filePath,
    buffer.length,
    metadata?.platform || null,
    metadata?.chatId || null,
    metadata?.messageId || null,
    userId
  );

  return {
    id,
    filename,
    category,
    filePath,
    fileSize: buffer.length,
  };
}

// Get file by ID
export function getFileById(id: string, userId: string): any {
  return db.prepare('SELECT * FROM media_files WHERE id = ? AND user_id = ?').get(id, userId);
}

// List files by category
export function listFilesByCategory(category: string, userId: string, limit = 50): any[] {
  return db.prepare(
    'SELECT * FROM media_files WHERE category = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(category, userId, limit) as any[];
}

// List all files
export function listAllFiles(userId: string, limit = 100): any[] {
  return db.prepare(
    'SELECT * FROM media_files WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as any[];
}

// Delete file
export function deleteFile(id: string, userId: string): boolean {
  const file = getFileById(id, userId);
  if (!file) return false;

  // Delete physical file
  if (fs.existsSync(file.file_path)) {
    fs.unlinkSync(file.file_path);
  }

  // Delete database record
  db.prepare('DELETE FROM media_files WHERE id = ? AND user_id = ?').run(id, userId);
  return true;
}

// Read file content (for documents)
export function readFileContent(id: string, userId: string): Buffer | null {
  const file = getFileById(id, userId);
  if (!file || !fs.existsSync(file.file_path)) return null;
  return fs.readFileSync(file.file_path);
}

// Update extracted text (for processed documents)
export function updateExtractedText(id: string, userId: string, extractedText: string): void {
  db.prepare(
    'UPDATE media_files SET extracted_text = ?, processed = 1 WHERE id = ? AND user_id = ?'
  ).run(extractedText, id, userId);
}

// Get files by chat
export function getFilesByChat(chatId: string, userId: string): any[] {
  return db.prepare(
    'SELECT * FROM media_files WHERE chat_id = ? AND user_id = ? ORDER BY created_at DESC'
  ).all(chatId, userId) as any[];
}

// Get file stats
export function getFileStats(userId: string): {
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
} {
  const stats = {
    totalFiles: 0,
    totalSize: 0,
    byCategory: {} as Record<string, { count: number; size: number }>,
  };

  const categories = ['images', 'videos', 'audios', 'documents'];
  for (const category of categories) {
    const result = db.prepare(
      'SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM media_files WHERE category = ? AND user_id = ?'
    ).get(category, userId) as any;
    
    stats.byCategory[category] = {
      count: result.count,
      size: result.size,
    };
    stats.totalFiles += result.count;
    stats.totalSize += result.size;
  }

  return stats;
}

// Clean up old files (optional maintenance)
export function cleanupOldFiles(daysOld: number, userId: string): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const oldFiles = db.prepare(
    'SELECT * FROM media_files WHERE user_id = ? AND created_at < ?'
  ).all(userId, cutoffDate.toISOString()) as any[];

  let deletedCount = 0;
  for (const file of oldFiles) {
    if (deleteFile(file.id, userId)) {
      deletedCount++;
    }
  }

  return deletedCount;
}
