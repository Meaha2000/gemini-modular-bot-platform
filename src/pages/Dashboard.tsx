import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Key, MessageSquare, Activity, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRequests: 0,
    activeKeys: 0,
    totalMemories: 0,
    errorsToday: 0
  });

  useEffect(() => {
    if (!user) return;
    
    const fetchStats = async () => {
      try {
        const data = await apiFetch('/api/stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [user]);

  const cards = [
    { title: 'Total Requests', value: stats.totalRequests, icon: MessageSquare, color: 'text-blue-500' },
    { title: 'Active Keys', value: stats.activeKeys, icon: Key, color: 'text-green-500' },
    { title: 'Contexts', value: stats.totalMemories, icon: Activity, color: 'text-purple-500' },
    { title: 'System Errors', value: stats.errorsToday, icon: AlertCircle, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-mono font-bold tracking-tight">System Overview</h1>
        <p className="text-muted-foreground font-mono text-sm">Real-time performance and resource monitoring.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-border shadow-none bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-none bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider">Telemetry Logs</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="h-[300px] flex items-center justify-center text-muted-foreground font-mono text-xs border border-dashed border-border rounded-lg">
                Connected to local production node. Monitoring active.
             </div>
          </CardContent>
        </Card>
        
        <Card className="border-border shadow-none bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider">Server Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               {['API Health', 'DB Connectivity', 'Memory Buffer'].map((label, i) => (
                 <div key={label} className="space-y-1">
                   <div className="flex justify-between text-[10px] font-mono text-muted-foreground uppercase">
                      <span>{label}</span>
                      <span>{label === 'API Health' || label === 'DB Connectivity' ? 'Online' : '98%'}</span>
                   </div>
                   <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: i === 2 ? '98%' : '100%' }} />
                   </div>
                 </div>
               ))}
            </div>
            <div className="mt-6 p-3 bg-secondary/50 rounded-lg text-[10px] font-mono">
              <p className="text-muted-foreground uppercase mb-1">Node Endpoint</p>
              <p className="truncate">http://localhost:3001/api</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
