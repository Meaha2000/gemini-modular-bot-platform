import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Bot, Lock, User } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-elegant border-accent/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-4">
            <Bot className="text-primary-foreground w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Admin Login</CardTitle>
          <CardDescription>Enter your credentials to manage the Gemini Bot Platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="username" 
                  className="pl-9"
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="admin"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-9"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Logging in...' : 'Sign In'}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Self-hosted production build v1.0.0
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
