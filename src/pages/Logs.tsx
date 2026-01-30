import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Terminal, Shield, Cpu, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface BotLog {
  id: string;
  request_payload: string;
  response_payload: string;
  raw_response: string;
  api_key_used: string;
  created_at: string;
}

export default function Logs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchLogs();
  }, [user]);

  const fetchLogs = async () => {
    try {
      const data = await apiFetch('/api/logs');
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-mono font-bold tracking-tight">System Logs</h1>
          <p className="text-muted-foreground font-mono text-sm">Review real-time transmission logs and node activity.</p>
        </div>
        <div className="flex items-center space-x-2 bg-secondary/30 p-2 rounded-lg border border-border mt-4 md:mt-0">
          <Switch id="raw-mode" checked={showRaw} onCheckedChange={setShowRaw} />
          <Label htmlFor="raw-mode" className="text-xs font-mono font-bold uppercase cursor-pointer">Show Raw Responses</Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Transmission Protocol', value: 'Gemini v1.5 Flash', icon: Cpu },
          { label: 'Security Context', value: 'Local Node (Self-Hosted)', icon: Shield },
          { label: 'Uptime', value: '100%', icon: Clock },
        ].map((item) => (
          <div key={item.label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center border border-border">
              <item.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase">{item.label}</p>
              <p className="text-sm font-mono font-bold">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="border-border shadow-none overflow-hidden bg-card">
        <div className="bg-secondary/30 p-4 border-b border-border flex items-center gap-2">
           <Terminal className="w-4 h-4" />
           <span className="text-xs font-mono font-bold uppercase tracking-wider">Live Transmission Stream</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/10">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-mono text-[10px] uppercase w-[150px]">Timestamp</TableHead>
                <TableHead className="font-mono text-[10px] uppercase w-[100px]">Key ID</TableHead>
                <TableHead className="font-mono text-[10px] uppercase">Payload Manifest</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-right w-[100px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center font-mono text-xs text-muted-foreground">
                    Initial signal capture in progress...
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => {
                const req = JSON.parse(log.request_payload || '{}');
                const isExpanded = expandedLog === log.id;
                
                return (
                  <React.Fragment key={log.id}>
                    <TableRow className="font-mono text-[11px] border-border hover:bg-secondary/30 transition-colors">
                      <TableCell className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {log.api_key_used?.substring(0, 8) || 'SYSTEM'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-2">
                             <span className="text-muted-foreground uppercase text-[9px] font-bold">REQ:</span>
                             <span className="truncate max-w-md">{req.prompt || 'Media data'}</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-muted-foreground uppercase text-[9px] font-bold">RES:</span>
                             <span className="truncate max-w-md italic">{log.response_payload?.substring(0, 100)}...</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <button 
                           onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                           className="p-1 hover:bg-secondary rounded"
                         >
                           {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                         </button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-secondary/20 font-mono text-[10px]">
                        <TableCell colSpan={4} className="p-4">
                          <div className="space-y-4">
                            <div>
                              <p className="text-muted-foreground uppercase font-bold mb-1">Full Response:</p>
                              <div className="bg-black/5 p-3 rounded border border-border whitespace-pre-wrap">
                                {log.response_payload}
                              </div>
                            </div>
                            {showRaw && (
                              <div>
                                <p className="text-muted-foreground uppercase font-bold mb-1">Raw API JSON:</p>
                                <pre className="bg-black/5 p-3 rounded border border-border overflow-x-auto">
                                  {JSON.stringify(JSON.parse(log.raw_response || '{}'), null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
