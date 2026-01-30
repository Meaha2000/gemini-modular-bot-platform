import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Send, Bot, User, Trash2, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function Playground() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if ((!input.trim() && selectedFiles.length === 0) || isLoading || !user) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg || 'Uploaded media' }]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('prompt', userMsg);
      formData.append('chatId', 'playground-default');
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const token = localStorage.getItem('token');
      const response = await fetch('/api/bot/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'model', content: data.response }]);
      setSelectedFiles([]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMemory = async () => {
    try {
      await apiFetch('/api/bot/clear-memory', {
        method: 'POST',
        body: JSON.stringify({ chatId: 'playground-default' })
      });
      setMessages([]);
      toast.success('Chat memory cleared for this session');
    } catch (err: any) {
      toast.error('Failed to clear memory');
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col gap-4 animate-fade-in p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-mono font-bold tracking-tight">Test Playground</h1>
          <p className="text-muted-foreground font-mono text-sm">Validate bot personas and multi-modal responses.</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearMemory} className="font-mono text-xs gap-2 border-red-500/20 text-red-500 hover:bg-red-500/10">
          <Trash2 className="w-4 h-4" />
          Clear Server Memory
        </Button>
      </div>

      <Card className="flex-1 border-border shadow-none flex flex-col overflow-hidden bg-card">
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 space-y-4">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-mono font-bold uppercase tracking-widest text-xs text-muted-foreground">System Ready</h3>
                  <p className="text-sm text-muted-foreground font-mono max-w-xs">
                    Self-hosted node online. Start a conversation to test current API key rotation and personality logic.
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center border border-border ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                   <div className={`p-4 rounded-lg font-mono text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 border border-border'}`}>
                      {msg.content}
                   </div>
                   <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      {msg.role === 'user' ? 'Operator' : 'AI Node'}
                   </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center border border-border bg-secondary">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2 p-4 bg-secondary/50 border border-border rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm font-mono text-muted-foreground">Processing signal...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-card/50">
          <div className="max-w-4xl mx-auto space-y-4">
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-secondary px-2 py-1 rounded text-xs font-mono">
                    <span className="truncate max-w-[100px]">{file.name}</span>
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}>
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onFileSelect} 
                className="hidden" 
                multiple 
                accept="image/*,audio/*,video/*"
              />
              <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                 <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </Button>
              <div className="flex-1 relative">
                <Input
                  placeholder="Transmit message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="font-mono text-sm pr-12"
                  disabled={isLoading}
                />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="absolute right-1 top-1 h-8 w-8 hover:bg-transparent"
                  onClick={handleSend}
                  disabled={isLoading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
