import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { Download, Copy } from 'lucide-react';

export default function QRBarcodeModal({ item, open, onClose }) {
  const qrRef = useRef(null);
  const barcodeRef = useRef(null);
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const qrValue = JSON.stringify({
    id: item.id,
    pn: item.part_number,
    desc: item.description,
    brand: item.device_brand,
    model: item.device_model,
    qty: item.quantity_available,
  });

  const barcodeValue = (item.part_number || item.id || 'PART').replace(/[^A-Za-z0-9\-\.]/g, '').slice(0, 40) || 'PART001';

  const downloadSVG = (ref, filename) => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  const copy = () => {
    navigator.clipboard.writeText(item.part_number || item.id);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold leading-tight">{item.description}</DialogTitle>
          <p className="text-xs text-muted-foreground font-mono">{item.part_number}</p>
        </DialogHeader>
        <Tabs defaultValue="qr">
          <TabsList className="w-full">
            <TabsTrigger value="qr" className="flex-1">QR Code</TabsTrigger>
            <TabsTrigger value="barcode" className="flex-1">Barcode</TabsTrigger>
          </TabsList>
          <TabsContent value="qr" className="flex flex-col items-center gap-3 pt-3">
            <div ref={qrRef} className="p-4 bg-white rounded-xl border">
              <QRCodeSVG value={qrValue} size={180} includeMargin />
            </div>
            <div className="flex gap-2 w-full">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => downloadSVG(qrRef, `QR_${item.part_number}.svg`)}>
                <Download className="w-3 h-3 mr-1" />Download
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={copy}>
                <Copy className="w-3 h-3 mr-1" />{copied ? 'Copied!' : 'Copy ID'}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="barcode" className="flex flex-col items-center gap-3 pt-3">
            <div ref={barcodeRef} className="p-4 bg-white rounded-xl border overflow-x-auto max-w-full">
              <Barcode value={barcodeValue} width={1.5} height={60} fontSize={11} />
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => downloadSVG(barcodeRef, `BC_${item.part_number}.svg`)}>
              <Download className="w-3 h-3 mr-1" />Download
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}