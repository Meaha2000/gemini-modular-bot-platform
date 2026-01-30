import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Wrench, Globe, Code2, FileVideo, Plus, Trash2, Globe2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface CustomTool {
  id: string;
  name: string;
  endpoint: string;
  description: string;
  is_active: number;
}

export default function ToolsPage() {
  const { user } = useAuth();
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [desc, setDesc] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) fetchTools();
  }, [user]);

  const fetchTools = async () => {
    try {
      const data = await apiFetch('/api/tools');
      setTools(data);
    } catch (err) {
      console.error('Failed to fetch tools:', err);
    }
  };

  const addTool = async () => {
    if (!name.trim() || !endpoint.trim() || !user) return;
    setIsLoading(true);
    try {
      await apiFetch('/api/tools', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          endpoint: endpoint.trim(),
          description: desc.trim()
        })
      });
      setName('');
      setEndpoint('');
      setDesc('');
      toast.success('Custom tool protocol integrated');
      fetchTools();
    } catch (e: any) {
      toast.error(e.message || 'Integration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTool = async (id: string, current: number) => {
    try {
      await apiFetch(`/api/tools/${id}/toggle`, {
        method: 'POST'
      });
      fetchTools();
    } catch (e: any) {
      toast.error('Operation failed');
    }
  };

  const deleteTool = async (id: string) => {
    try {
      await apiFetch(`/api/tools/${id}`, {
        method: 'DELETE'
      });
      toast.success('Tool removed');
      fetchTools();
    } catch (e: any) {
      toast.error('Deletion failed');
    }
  };

  const coreTools = [
    { name: 'Global Web Search', icon: Globe, status: 'Online', desc: 'Real-time indexing and scraping of the public internet.' },
    { name: 'Sandboxed Logic', icon: Code2, status: 'Online', desc: 'Secure execution of Python and JS for complex computations.' },
    { name: 'Media Processor', icon: FileVideo, status: 'Online', desc: 'Audio/Video transcoding and image manipulation (ffmpeg).' },
  ];

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-mono font-bold tracking-tight">Extension Matrix</h1>
        <p className="text-muted-foreground font-mono text-sm">Configure native capabilities and external webhook protocols.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {coreTools.map((tool) => (
          <Card key={tool.name} className="border-border shadow-none bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between mb-2">
                 <div className="w-8 h-8 bg-primary/5 rounded border border-border flex items-center justify-center">
                    <tool.icon className="w-4 h-4 text-primary" />
                 </div>
                 <Badge variant="outline" className="text-[9px] font-mono border-green-500/20 text-green-600 bg-green-500/5 uppercase font-bold tracking-widest">
                    {tool.status}
                 </Badge>
              </div>
              <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider">{tool.name}</CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">{tool.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-border shadow-none h-fit bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Register External Plugin
            </CardTitle>
            <CardDescription className="font-mono text-[10px] uppercase">Link a third-party API endpoint to the LLM core.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-1.5">
               <label className="text-[10px] font-mono uppercase text-muted-foreground font-bold">Tool Identifier</label>
               <Input placeholder="e.g. WEATHER_SVC" value={name} onChange={(e) => setName(e.target.value)} className="font-mono text-xs" />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-mono uppercase text-muted-foreground font-bold">Webhook URL</label>
               <Input placeholder="https://api.example.com/v1" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="font-mono text-xs" />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-mono uppercase text-muted-foreground font-bold">Protocol Definition</label>
               <Textarea placeholder="Describe parameters and expected JSON output..." value={desc} onChange={(e) => setDesc(e.target.value)} className="font-mono text-xs h-24" />
             </div>
          </CardContent>
          <CardFooter>
            <Button onClick={addTool} disabled={isLoading || !name || !endpoint} className="w-full gap-2 font-mono uppercase tracking-widest text-xs h-10">
              <Wrench className="w-3.5 h-3.5" />
              Initialize Plugin
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-2 border-border shadow-none overflow-hidden bg-card">
          <CardHeader className="bg-secondary/30 border-b border-border">
            <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider">Custom Extension Pool</CardTitle>
          </CardHeader>
          <div className="p-0">
             {tools.length === 0 && (
               <div className="h-60 flex flex-col items-center justify-center gap-4 border-b border-border last:border-0 p-8">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center border border-border">
                     <Globe2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-mono text-muted-foreground text-center max-w-xs leading-relaxed">
                     No external webhooks connected. The bot is restricted to native protocols only.
                  </p>
               </div>
             )}
             {tools.map((t) => (
               <div key={t.id} className="p-4 border-b border-border last:border-0 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-primary/5 rounded-lg border border-border flex items-center justify-center">
                        <Wrench className="w-4 h-4 text-primary" />
                     </div>
                     <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <h3 className="text-xs font-mono font-bold uppercase">{t.name}</h3>
                           <Badge variant="secondary" className="text-[8px] font-mono h-4 uppercase">Webhook</Badge>
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground truncate max-w-md">{t.endpoint}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <Switch checked={t.is_active === 1} onCheckedChange={() => toggleTool(t.id, t.is_active)} />
                     <Button variant="ghost" size="icon" onClick={() => deleteTool(t.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                     </Button>
                  </div>
               </div>
             ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
