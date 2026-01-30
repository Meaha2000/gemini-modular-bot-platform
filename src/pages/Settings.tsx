import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Key, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface GeminiKey {
  id: string;
  key: string;
  status: string;
  last_used_at: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<GeminiKey[]>([]);
  const [newKey, setNewKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) fetchKeys();
  }, [user]);

  const fetchKeys = async () => {
    try {
      const data = await apiFetch('/api/keys');
      setKeys(data);
    } catch (err) {
      console.error('Failed to fetch keys:', err);
    }
  };

  const addKey = async () => {
    if (!newKey.trim() || !user) return;
    setIsLoading(true);
    try {
      await apiFetch('/api/keys', {
        method: 'POST',
        body: JSON.stringify({ key: newKey.trim() })
      });
      setNewKey('');
      toast.success('API Key added to pool');
      fetchKeys();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add key');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteKey = async (id: string) => {
    try {
      await apiFetch(`/api/keys/${id}`, {
        method: 'DELETE'
      });
      toast.success('Key removed');
      fetchKeys();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete key');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-mono font-bold tracking-tight">API Management</h1>
        <p className="text-muted-foreground font-mono text-sm">Configure your Google Gemini API key pool for round-robin rotation.</p>
      </div>

      <Card className="border-border shadow-none bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add New Credential
          </CardTitle>
          <CardDescription className="font-mono text-xs">Enter a valid Google Gemini API Key. It will be added to the active rotation pool.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="AIzaSy..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="font-mono text-sm"
              disabled={isLoading}
            />
            <Button onClick={addKey} disabled={isLoading || !newKey} className="gap-2 font-mono h-10">
              <Key className="w-4 h-4" />
              Register Key
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-none overflow-hidden bg-card">
        <CardHeader className="bg-secondary/30 border-b border-border">
          <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider">Active Key Pool</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Credential ID</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Secret (Masked)</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Last Transmission</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center font-mono text-xs text-muted-foreground">
                    No API keys registered. The system is currently offline.
                  </TableCell>
                </TableRow>
              )}
              {keys.map((k) => (
                <TableRow key={k.id} className="font-mono text-xs">
                  <TableCell className="font-medium truncate max-w-[100px]">{k.id}</TableCell>
                  <TableCell>{k.key.substring(0, 8)}••••••••••••</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {k.status === 'active' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <span className="capitalize">{k.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                         <RefreshCw className="w-3.5 h-3.5" />
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                         onClick={() => deleteKey(k.id)}
                       >
                         <Trash2 className="w-3.5 h-3.5" />
                       </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
