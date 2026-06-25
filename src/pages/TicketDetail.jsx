import React, { useState } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  statusColors,
  statusLabels,
  priorityColors,
  priorityLabels,
  categoryLabels,
} from '@/lib/utils/ticketUtils';

import { format } from 'date-fns';

import {
  ArrowLeft,
  Send,
  Star,
  Loader2,
  User,
  Clock,
  Tag,
  AlertTriangle,
  Image,
  Video,
} from 'lucide-react';

import { Separator } from '@/components/ui/separator';

async function fetchTicket(id) {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

async function fetchComments(ticketId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}

async function fetchEngineers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'engineer')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data || [];
}

function getFileUrl(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.url || item.publicUrl || item.file_url || '';
}

function getFileName(item, fallback) {
  if (!item) return fallback;
  if (typeof item === 'string') return fallback;
  return item.name || fallback;
}

function EvidenceLinks({ title, icon, items }) {
  const safeItems = Array.isArray(items) ? items : [];

  if (safeItems.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        {icon}
        {title}
      </p>

      <div className="flex flex-wrap gap-2">
        {safeItems.map((item, index) => {
          const fileUrl = getFileUrl(item);
          const fileName = getFileName(item, `${title} ${index + 1}`);

          if (!fileUrl) return null;

          return (
            <a
              key={`${title}-${index}`}
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline border rounded-lg px-3 py-2"
            >
              {fileName}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const role = user?.role || 'client';

  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => fetchComments(id),
    enabled: !!id,
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: fetchEngineers,
    enabled: role === 'admin' || role === 'helpdesk',
  });

  const updateTicket = async (data) => {
    const { error } = await supabase
      .from('tickets')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    const { error: auditError } = await supabase.from('audit_logs').insert({
      action: 'ticket_updated',
      entity_type: 'Ticket',
      entity_id: id,
      user_email: user?.email,
      user_name: user?.full_name || user?.name || user?.email,
      details: JSON.stringify(data),
      created_at: new Date().toISOString(),
    });

    if (auditError) {
      console.warn('Ticket audit log could not be saved:', auditError.message);
    }

    await queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    await queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  const handleAssign = async (engineerEmail) => {
    if (!engineerEmail) {
      alert('No engineer selected.');
      return;
    }

    if (!ticket?.id && !id) {
      alert('Ticket ID not found.');
      return;
    }

    const engineer = engineers.find((item) => item.email === engineerEmail);
    const ticketTitle = ticket?.title || ticket?.ticket_id || ticket?.ticket_number || 'Untitled Ticket';
    const ticketLink = `/tickets/${id}`;
    const now = new Date().toISOString();

    try {
      await updateTicket({
        assigned_to: engineerEmail,
        assigned_engineer_email: engineerEmail,
        assigned_to_name: engineer?.full_name || engineerEmail,
        status: 'assigned',
        assigned_at: now,
      });

      const { error: notifyError } = await supabase
        .from('notifications')
        .insert({
          user_email: engineerEmail,
          title: 'New Ticket Assigned',
          message: `You have been assigned ticket: ${ticketTitle}`,
          type: 'ticket_assigned',
          link: ticketLink,
          related_id: id,
          related_type: 'ticket',
          sound: 'bell',
          read: false,
          created_at: now,
        });

      if (notifyError) {
        console.warn('Ticket assigned but notification failed:', notifyError.message);
        alert('Ticket assigned successfully, but notification could not be sent.');
      } else {
        alert(`Ticket assigned and notification sent to ${engineerEmail}`);
      }

      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } catch (error) {
      console.error('Ticket assignment failed:', error);
      alert('Ticket assignment failed: ' + (error?.message || 'Unknown error'));
    }
  };

  const handleStatusChange = async (newStatus) => {
    const now = new Date().toISOString();
    const data = { status: newStatus };

    if (newStatus === 'resolved') {
      data.resolved_date = now;
    }

    if (newStatus === 'closed') {
      data.closed_date = now;
    }

    await updateTicket(data);

    if (newStatus === 'resolved' && ticket.client_email) {
      const { error } = await supabase.from('notifications').insert({
        user_email: ticket.client_email,
        title: 'Ticket Resolved',
        message: `Your ticket "${ticket.title}" has been resolved.`,
        type: 'ticket_resolved',
        related_id: id,
        related_type: 'ticket',
        read: false,
        created_at: now,
      });

      if (error) {
        console.warn('Client resolution notification failed:', error.message);
      }
    }
  };

  const handleComment = async (event) => {
    event.preventDefault();

    if (!comment.trim()) return;

    setSending(true);

    try {
      const { error } = await supabase.from('comments').insert({
        ticket_id: id,
        author_email: user?.email,
        author_name: user?.full_name || user?.name || user?.email,
        content: comment.trim(),
        is_internal: isInternal,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      setComment('');
      setIsInternal(false);

      await queryClient.invalidateQueries({ queryKey: ['comments', id] });
    } catch (error) {
      alert('Error sending comment: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleRate = async () => {
    if (!rating) return;

    await updateTicket({
      rating,
      rating_comment: ratingComment.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Ticket not found
      </div>
    );
  }

  const visibleComments = comments.filter(
    (item) => role !== 'client' || !item.is_internal
  );

  const evidencePhotos = Array.isArray(ticket.evidence_photos)
    ? ticket.evidence_photos
    : [];

  const evidenceVideos = Array.isArray(ticket.evidence_videos)
    ? ticket.evidence_videos
    : [];

  const attachments = Array.isArray(ticket.attachments)
    ? ticket.attachments
    : [];

  return (
    <div className="space-y-5 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-muted-foreground">
              {ticket.ticket_number || ticket.ticket_id}
            </span>

            <Badge
              variant="outline"
              className={`${priorityColors[ticket.priority]} text-[10px]`}
            >
              {priorityLabels[ticket.priority] || ticket.priority}
            </Badge>

            <Badge
              variant="outline"
              className={`${statusColors[ticket.status]} text-[10px]`}
            >
              {statusLabels[ticket.status] || ticket.status}
            </Badge>
          </div>

          <h1 className="text-xl font-bold">{ticket.title}</h1>
        </div>

        {ticket.escalated && (
          <Badge className="bg-red-500 text-white">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Escalated
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {ticket.description}
              </p>

              <EvidenceLinks
                title="Attachments"
                icon={<Image className="w-3.5 h-3.5" />}
                items={attachments}
              />
            </CardContent>
          </Card>

          {(evidencePhotos.length > 0 || evidenceVideos.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Engineer Evidence</CardTitle>
              </CardHeader>

              <CardContent>
                <EvidenceLinks
                  title="Evidence Photos"
                  icon={<Image className="w-3.5 h-3.5" />}
                  items={evidencePhotos}
                />

                <EvidenceLinks
                  title="Evidence Videos"
                  icon={<Video className="w-3.5 h-3.5" />}
                  items={evidenceVideos}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                Activity ({visibleComments.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {visibleComments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet
                </p>
              )}

              {visibleComments.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">
                      {item.author_name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">
                        {item.author_name}
                      </span>

                      {item.is_internal && (
                        <Badge variant="outline" className="text-[9px]">
                          Internal
                        </Badge>
                      )}

                      <span className="text-[10px] text-muted-foreground">
                        {item.created_at
                          ? format(new Date(item.created_at), 'MMM d, h:mm a')
                          : ''}
                      </span>
                    </div>

                    <p className="text-sm mt-1 whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </div>
                </div>
              ))}

              <Separator />

              <form onSubmit={handleComment} className="space-y-3">
                <Textarea
                  placeholder="Add a comment..."
                  className="h-20"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />

                <div className="flex items-center justify-between">
                  {role !== 'client' && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(event) => setIsInternal(event.target.checked)}
                        className="rounded"
                      />
                      Internal note
                    </label>
                  )}

                  <Button
                    type="submit"
                    size="sm"
                    disabled={sending || !comment.trim()}
                    className="ml-auto"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1" />
                    )}
                    Send
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {role === 'client' && ticket.status === 'resolved' && !ticket.rating && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Rate This Service</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setRating(score)}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          score <= rating
                            ? 'text-primary fill-primary'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <Textarea
                  placeholder="Leave feedback..."
                  value={ratingComment}
                  onChange={(event) => setRatingComment(event.target.value)}
                  className="h-16"
                />

                <Button size="sm" onClick={handleRate} disabled={rating === 0}>
                  Submit Rating
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>

                {role === 'admin' || role === 'helpdesk' || role === 'engineer' ? (
                  <Select value={ticket.status || ''} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={statusColors[ticket.status]}>
                    {statusLabels[ticket.status] || ticket.status}
                  </Badge>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Category</p>
                <div className="flex items-center gap-1.5 text-sm">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  {categoryLabels[ticket.category] || ticket.category || 'Not set'}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Client</p>
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  {ticket.client_name || ticket.client_email || 'Not set'}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Assigned Engineer
                </p>

                {role === 'admin' || role === 'helpdesk' ? (
                  <Select
                    value={ticket.assigned_to || ticket.assigned_engineer_email || ''}
                    onValueChange={handleAssign}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Assign engineer..." />
                    </SelectTrigger>

                    <SelectContent>
                      {engineers.map((engineer) => (
                        <SelectItem key={engineer.email} value={engineer.email}>
                          {engineer.full_name || engineer.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">
                    {ticket.assigned_to_name || 'Unassigned'}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {ticket.created_at
                    ? format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')
                    : 'Not recorded'}
                </div>
              </div>

              {ticket.assigned_at && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Assigned</p>
                  <p className="text-sm">
                    {format(new Date(ticket.assigned_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}

              {ticket.resolved_date && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Resolved</p>
                  <p className="text-sm">
                    {format(new Date(ticket.resolved_date), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}

              {ticket.rating && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Rating</p>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Star
                        key={score}
                        className={`w-4 h-4 ${
                          score <= ticket.rating
                            ? 'text-primary fill-primary'
                            : 'text-muted'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {(role === 'admin' || role === 'helpdesk') &&
                !ticket.escalated &&
                ticket.status !== 'closed' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => updateTicket({ escalated: true })}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                    Escalate
                  </Button>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}