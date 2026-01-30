import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { UserCircle, Plus, Trash2, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface Personality {
  id: string;
  name: string;
  system_prompt: string;
  is_active: number;
}

export default function Personalities() {
  const { user } = useAuth();
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) fetchPersonalities();
  }, [user]);

  const fetchPersonalities = async () => {
    try {
      const data = await apiFetch('/api/personalities');
      setPersonalities(data);
    } catch (err) {
      console.error('Failed to fetch personalities:', err);
    }
  };

  const addPersonality = async () => {
    if (!name.trim() || !prompt.trim() || !user) return;
    setIsLoading(true);
    try {
      await apiFetch('/api/personalities', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          systemPrompt: prompt.trim()
        })
      });
      setName('');
      setPrompt('');
      toast.success('Personality profile created');
      fetchPersonalities();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  const setActive = async (id: string) => {
    try {
      await apiFetch(`/api/personalities/${id}/activate`, {
        method: 'POST'
      });
      toast.success('Persona activated globally');
      fetchPersonalities();
    } catch (e: any) {
      toast.error(e.message || 'Activation failed');
    }
  };

  const deletePersonality = async (id: string) => {
    try {
      await apiFetch(`/api/personalities/${id}`, {
        method: 'DELETE'
      });
      toast.success('Profile removed');
      fetchPersonalities();
    } catch (e: any) {
      toast.error(e.message || 'Deletion failed');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-mono font-bold tracking-tight">Persona Manager</h1>
        <p className="text-muted-foreground font-mono text-sm">Define and switch between distinct behavioral profiles for your AI Node.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-border shadow-none h-fit sticky top-24 bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Blueprint New Persona
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-muted-foreground font-bold">Identity Name</label>
              <Input
                placeholder="e.g. Cyber Security Expert"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-muted-foreground font-bold">System Directives</label>
              <Textarea
                placeholder="You are a highly advanced AI that speaks in riddles..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="font-mono text-xs min-h-[200px]"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={addPersonality} disabled={isLoading || !name || !prompt} className="w-full gap-2 font-mono h-10">
              <Sparkles className="w-4 h-4" />
              Forge Identity
            </Button>
          </CardFooter>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Available Profiles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personalities.map((p) => (
              <Card key={p.id} className={`border-border bg-card shadow-none transition-all ${p.is_active ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4" />
                    <CardTitle className="text-sm font-mono font-bold">{p.name}</CardTitle>
                  </div>
                  {p.is_active ? (
                    <Badge className="bg-primary text-primary-foreground font-mono text-[10px] uppercase">ACTIVE</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setActive(p.id)} className="font-mono text-[10px] h-6 px-2 hover:bg-primary hover:text-primary-foreground">ACTIVATE</Button>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-mono text-muted-foreground line-clamp-4 leading-relaxed">
                    {p.system_prompt}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 pt-0">
                   {!p.is_active && (
                     <Button variant="ghost" size="icon" onClick={() => deletePersonality(p.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                       <Trash2 className="w-3.5 h-3.5" />
                     </Button>
                   )}
                   {p.is_active && (
                     <div className="h-8 flex items-center gap-1 text-[10px] font-mono text-primary font-bold">
                        <Check className="w-3.5 h-3.5" />
                        DEPLOYED
                     </div>
                   )}
                </CardFooter>
              </Card>
            ))}
          </div>
          {personalities.length === 0 && (
            <div className="h-40 flex items-center justify-center border border-dashed border-border rounded-lg text-muted-foreground font-mono text-xs">
              No persona blueprints found in repository.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
