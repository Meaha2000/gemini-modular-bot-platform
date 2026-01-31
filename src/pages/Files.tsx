import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  Image, 
  Video, 
  Music, 
  FileText, 
  Upload, 
  Trash2, 
  Download,
  HardDrive,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface MediaFile {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  category: string;
  file_size: number;
  platform?: string;
  chat_id?: string;
  processed: boolean;
  created_at: string;
}

interface FileStats {
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
}

const CATEGORY_ICONS = {
  images: <Image className="w-4 h-4 text-pink-500" />,
  videos: <Video className="w-4 h-4 text-red-500" />,
  audios: <Music className="w-4 h-4 text-purple-500" />,
  documents: <FileText className="w-4 h-4 text-blue-500" />,
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [stats, setStats] = useState<FileStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFiles();
      fetchStats();
    }
  }, [user, selectedCategory]);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const url = selectedCategory === 'all' 
        ? '/api/files' 
        : `/api/files?category=${selectedCategory}`;
      const data = await apiFetch(url);
      setFiles(data);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await apiFetch('/api/files/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('token');
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Upload failed');
        }
      }
      toast.success(`${fileList.length} file(s) uploaded`);
      fetchFiles();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this file?')) return;
    try {
      await apiFetch(`/api/files/${id}`, { method: 'DELETE' });
      toast.success('File deleted');
      fetchFiles();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete file');
    }
  };

  const handleDownload = (id: string, filename: string) => {
    const token = localStorage.getItem('token');
    const link = document.createElement('a');
    link.href = `/api/files/${id}/download`;
    link.download = filename;
    link.click();
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, []);

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-mono font-bold tracking-tight">File Storage</h1>
          <p className="text-muted-foreground font-mono text-sm">Multi-modal file system for images, videos, audio, and documents</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-border shadow-none bg-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <HardDrive className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="text-xl font-mono font-bold">{stats.totalFiles}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{formatFileSize(stats.totalSize)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {Object.entries(stats.byCategory).map(([category, data]) => (
            <Card key={category} className="border-border shadow-none bg-card">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    {CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]}
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider capitalize">{category}</p>
                    <p className="text-xl font-mono font-bold">{data.count}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{formatFileSize(data.size)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Zone */}
      <Card 
        className={`border-2 border-dashed shadow-none transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card'
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="p-4 rounded-full bg-secondary">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-mono font-medium">
                {isUploading ? 'Uploading...' : 'Drag & drop files here'}
              </p>
              <p className="text-sm font-mono text-muted-foreground">or click to browse</p>
            </div>
            <input
              type="file"
              multiple
              className="hidden"
              id="file-upload"
              onChange={(e) => handleUpload(e.target.files)}
              disabled={isUploading}
            />
            <Button
              variant="outline"
              className="font-mono"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isUploading}
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Browse Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      <Card className="border-border shadow-none overflow-hidden bg-card">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider">Files</CardTitle>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="font-mono text-[10px] h-6 px-2">All</TabsTrigger>
                <TabsTrigger value="images" className="font-mono text-[10px] h-6 px-2">Images</TabsTrigger>
                <TabsTrigger value="videos" className="font-mono text-[10px] h-6 px-2">Videos</TabsTrigger>
                <TabsTrigger value="audios" className="font-mono text-[10px] h-6 px-2">Audio</TabsTrigger>
                <TabsTrigger value="documents" className="font-mono text-[10px] h-6 px-2">Docs</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">File</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Type</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Size</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Platform</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Date</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center font-mono text-xs text-muted-foreground">
                    Loading files...
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center font-mono text-xs text-muted-foreground">
                    No files found. Upload some files to get started.
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file) => (
                  <TableRow key={file.id} className="font-mono text-xs">
                    <TableCell className="max-w-[200px]">
                      <div className="flex items-center gap-2">
                        {CATEGORY_ICONS[file.category as keyof typeof CATEGORY_ICONS]}
                        <span className="truncate" title={file.original_name}>{file.original_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{file.mime_type}</TableCell>
                    <TableCell>{formatFileSize(file.file_size)}</TableCell>
                    <TableCell>{file.platform || '-'}</TableCell>
                    <TableCell>{new Date(file.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDownload(file.id, file.original_name)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => handleDelete(file.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
