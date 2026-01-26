import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Bell, Send, Users, CheckCircle, XCircle, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

interface PushSubscription {
  id: string;
  user_id: string | null;
  endpoint: string;
  device_info: {
    platform?: string;
    model?: string;
    os_version?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export default function AdminNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: number; failed: number } | null>(null);
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(new Set());

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

  // Fetch all subscriptions
  const { data: subscriptions, isLoading: subscriptionsLoading, refetch: refetchSubscriptions } = useQuery({
    queryKey: ['push-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PushSubscription[];
    },
  });

  const subscriptionCount = subscriptions?.length || 0;

  // Delete subscription mutation
  const deleteSubscriptionMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-subscriptions'] });
      setSelectedSubscriptions(new Set());
      toast.success('Subscriber(s) deleted successfully');
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Failed to delete subscriber(s)');
    },
  });

  const handleSelectAll = () => {
    if (selectedSubscriptions.size === subscriptions?.length) {
      setSelectedSubscriptions(new Set());
    } else {
      setSelectedSubscriptions(new Set(subscriptions?.map(s => s.id) || []));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedSubscriptions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedSubscriptions(newSet);
  };

  const handleDeleteSelected = () => {
    if (selectedSubscriptions.size === 0) return;
    deleteSubscriptionMutation.mutate(Array.from(selectedSubscriptions));
  };

  const handleDeleteOne = (id: string) => {
    deleteSubscriptionMutation.mutate([id]);
  };

  const sendToAll = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Please enter both title and body');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      // Fetch all subscriptions
      const { data: subs, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint');

      if (fetchError) throw fetchError;

      if (!subs || subs.length === 0) {
        toast.error('No push subscriptions found');
        setIsSending(false);
        return;
      }

      let successCount = 0;
      let failureCount = 0;
      const unregisteredIds: string[] = [];

      // Send to each token
      for (const sub of subs) {
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
        refetchSubscriptions();
      }

      // Log the notification
      await supabase.from('notification_logs').insert({
        title: title.trim(),
        body: body.trim(),
        target_type: 'all',
        sent_count: subs.length,
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

  const getDeviceInfo = (sub: PushSubscription) => {
    if (sub.device_info) {
      const parts = [];
      if (sub.device_info.platform) parts.push(sub.device_info.platform);
      if (sub.device_info.model) parts.push(sub.device_info.model);
      if (sub.device_info.os_version) parts.push(`v${sub.device_info.os_version}`);
      return parts.join(' • ') || 'Unknown';
    }
    return 'Unknown';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Push Notifications</h1>
          <p className="text-muted-foreground">Send push notifications and manage subscribers</p>
        </div>

        <Tabs defaultValue="compose" className="space-y-4">
          <TabsList>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="subscribers">Subscribers ({subscriptionCount})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose" className="space-y-4">
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
                        Send to All ({subscriptionCount} devices)
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
                  <div className="text-4xl font-bold">{subscriptionCount}</div>
                  <p className="text-sm text-muted-foreground">Registered devices</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Subscribers Tab */}
          <TabsContent value="subscribers">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Push Subscribers</CardTitle>
                    <CardDescription>Manage registered devices</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchSubscriptions()}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    {selectedSubscriptions.size > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Selected ({selectedSubscriptions.size})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Subscribers?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {selectedSubscriptions.size} subscriber(s)? 
                              They will no longer receive push notifications.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteSelected}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {subscriptionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : subscriptions && subscriptions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={selectedSubscriptions.size === subscriptions.length && subscriptions.length > 0}
                            onChange={handleSelectAll}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Token (Preview)</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedSubscriptions.has(sub.id)}
                              onChange={() => handleSelectOne(sub.id)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {getDeviceInfo(sub)}
                          </TableCell>
                          <TableCell>
                            {sub.user_id ? (
                              <Badge variant="outline">Linked</Badge>
                            ) : (
                              <Badge variant="secondary">Anonymous</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                            {sub.endpoint.slice(0, 40)}...
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(sub.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Subscriber?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This device will no longer receive push notifications.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteOne(sub.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No push subscribers yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
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
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}