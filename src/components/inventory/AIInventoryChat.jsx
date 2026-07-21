import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, X, Loader2, Sparkles } from 'lucide-react';

function generateLocalReply(message, items = []) {
  const q = message.toLowerCase();

  const available = items.filter(i => (Number(i.quantity_available) || 0) > (Number(i.minimum_stock_level) || 2));
  const low = items.filter(i => (Number(i.quantity_available) || 0) > 0 && (Number(i.quantity_available) || 0) <= (Number(i.minimum_stock_level) || 2));
  const out = items.filter(i => (Number(i.quantity_available) || 0) === 0);

  const matched = items.filter(i => {
    const text = `${i.description || ''} ${i.part_number || ''} ${i.device_brand || ''} ${i.device_model || ''} ${i.category_group || ''}`.toLowerCase();
    return q.split(/\s+/).some(word => word.length > 2 && text.includes(word));
  });

  if (q.includes('low stock')) {
    return low.length
      ? `Low stock items: ${low.slice(0, 10).map(i => `${i.description} (${i.quantity_available} left)`).join(', ')}.`
      : 'No low stock items found.';
  }

  if (q.includes('out of stock') || q.includes('stock out')) {
    return out.length
      ? `Out of stock items: ${out.slice(0, 10).map(i => i.description).join(', ')}.`
      : 'No out-of-stock items found.';
  }

  if (matched.length > 0) {
    return `I found ${matched.length} matching item(s): ${matched.slice(0, 8).map(i => `${i.description} | PN: ${i.part_number || 'N/A'} | Qty: ${i.quantity_available || 0}`).join('; ')}`;
  }

  return `Current inventory summary: ${items.length} total parts, ${available.length} available, ${low.length} low stock, ${out.length} out of stock. Ask me by part number, brand, model, or stock status.`;
}

export default function AIInventoryChat({ items = [] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm ARK Inventory Assistant. Ask me about parts, stock levels, categories, or device compatibility."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg) return;

    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      const reply = generateLocalReply(msg, items);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setLoading(false);
    }, 400);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-slate-900/50 border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: '480px' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#ff5a00]" />
              <span className="font-semibold text-sm">ARK Inventory AI</span>
            </div>
            <button onClick={() => setOpen(false)}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && send()}
              placeholder="Ask about parts, stock…"
              className="h-9 text-sm flex-1"
            />

            <Button
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={send}
              disabled={loading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
