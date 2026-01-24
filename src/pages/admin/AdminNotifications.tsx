import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Bell, Send, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  target_type: string;
  sent_count: number;
  success_count: number;
  failure_count: number;
  sent_at: string;
}

export default function AdminNotifications() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: number; failed: number } | null>(null);

  // Fetch notification logs
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['notification-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as NotificationLog[];
    },
  });

  // Fetch subscription count
  const { data: subscriptionCount } = useQuery({
    queryKey: ['push-subscription-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    },
  });

  const sendToAll = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Please enter both title and body');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      // Fetch all subscriptions
      const { data: subscriptions, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint');

      if (fetchError) throw fetchError;

      if (!subscriptions || subscriptions.length === 0) {
        toast.error('No push subscriptions found');
        setIsSending(false);
        return;
      }

      let successCount = 0;
      let failureCount = 0;
      const unregisteredIds: string[] = [];

      // Send to each token
      for (const sub of subscriptions) {
        try {
          const { data, error } = await supabase.functions.invoke('send-push-notification', {
            body: {
              token: sub.endpoint,
              title: title.trim(),
              body: body.trim(),
              data: { type: 'broadcast' },
            },
          });

          if (error) {
            console.error('Edge function error:', error);
            failureCount++;
            continue;
          }

          if (data?.success) {
            successCount++;
          } else {
            failureCount++;
            // Check for UNREGISTERED token
            if (data?.errorCode === 'UNREGISTERED' || data?.errorCode === 'NOT_FOUND') {
              unregisteredIds.push(sub.id);
            }
          }
        } catch (err) {
          console.error('Send error:', err);
          failureCount++;
        }
      }

      // Delete unregistered tokens
      if (unregisteredIds.length > 0) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('id', unregisteredIds);
        
        console.log(`Deleted ${unregisteredIds.length} unregistered tokens`);
      }

      // Log the notification
      await supabase.from('notification_logs').insert({
        title: title.trim(),
        body: body.trim(),
        target_type: 'all',
        sent_count: subscriptions.length,
        success_count: successCount,
        failure_count: failureCount,
        sent_by: user?.id,
      });

      setSendResult({ success: successCount, failed: failureCount });
      
      if (successCount > 0) {
        toast.success(`Notification sent to ${successCount} devices`);
      }
      if (failureCount > 0) {
        toast.warning(`Failed to send to ${failureCount} devices`);
      }

      // Reset form
      setTitle('');
      setBody('');
      refetchLogs();

    } catch (error) {
      console.error('Send all error:', error);
      toast.error('Failed to send notifications');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Push Notifications</h1>
          <p className="text-muted-foreground">Send push notifications to app users</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Send Notification Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Compose Notification
              </CardTitle>
              <CardDescription>
                Send a push notification to all registered devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Notification title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  placeholder="Notification message"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={isSending}
                  rows={4}
                />
              </div>
              <Button 
                onClick={sendToAll} 
                disabled={isSending || !title.trim() || !body.trim()}
                className="w-full"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send to All ({subscriptionCount || 0} devices)
                  </>
                )}
              </Button>

              {sendResult && (
                <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{sendResult.success} sent</span>
                  </div>
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>{sendResult.failed} failed</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Subscribers
              </CardTitle>
              <CardDescription>
                Push notification statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{subscriptionCount || 0}</div>
              <p className="text-sm text-muted-foreground">Registered devices</p>
            </CardContent>
          </Card>
        </div>

        {/* Notification History */}
        <Card>
          <CardHeader>
            <CardTitle>Notification History</CardTitle>
            <CardDescription>Previously sent notifications</CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs && logs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Success</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.title}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{log.body}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.sent_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-600">
                          {log.success_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{log.failure_count}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(log.sent_at), 'MMM d, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No notifications sent yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
