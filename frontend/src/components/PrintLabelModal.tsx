import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PrintLabelModalProps {
  type: 'order' | 'fabric';
  id: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export function PrintLabelModal({ type, id, title, subtitle, onClose }: PrintLabelModalProps) {
  const scanUrl = `${window.location.origin}/scan/${type}/${encodeURIComponent(id)}`;
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handlePrint() {
    const printArea = printAreaRef.current;
    if (!printArea) return;

    const printWindow = window.open('', '_blank', 'width=400,height=400');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>QR Etiket — ${id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, sans-serif;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .label {
      width: 62mm;
      padding: 6mm 5mm 5mm;
      border: 1px solid #ccc;
      border-radius: 4mm;
      text-align: center;
    }
    .brand {
      font-size: 7pt;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 3mm;
    }
    .qr {
      display: flex;
      justify-content: center;
      margin-bottom: 3mm;
    }
    .title {
      font-size: 9pt;
      font-weight: 700;
      color: #111;
      margin-bottom: 1mm;
      word-break: break-all;
    }
    .subtitle {
      font-size: 7pt;
      color: #666;
      margin-bottom: 2mm;
    }
    .id {
      font-size: 7pt;
      font-family: monospace;
      color: #aaa;
    }
  </style>
</head>
<body>
  <div class="label">
    <p class="brand">Erdal Güda</p>
    <div class="qr">${printArea.querySelector('svg')?.outerHTML ?? ''}</div>
    <p class="title">${title}</p>
    ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
    <p class="id">${id}</p>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1001,
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border, #e5e5e5)',
          borderRadius: 16,
          padding: '28px 32px',
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint, #aaa)' }}>
              QR Etiket
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #111)' }}>
              {title}
            </p>
            {subtitle && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted, #666)' }}>{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted, #999)', lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>

        {/* QR code */}
        <div ref={printAreaRef} style={{ padding: 12, background: '#fff', borderRadius: 10, border: '1px solid var(--border, #eee)' }}>
          <QRCodeSVG value={scanUrl} size={180} level="M" />
        </div>

        <p style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-faint, #aaa)', wordBreak: 'break-all', textAlign: 'center' }}>
          {id}
        </p>

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              flex: 1,
              padding: '9px 0',
              background: 'var(--accent, #2563eb)',
              color: 'var(--accent-text, #fff)',
              border: 'none',
              borderRadius: 8,
              font: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Yazdır
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '9px 0',
              background: 'transparent',
              color: 'var(--text-muted, #666)',
              border: '1px solid var(--border, #e5e5e5)',
              borderRadius: 8,
              font: 'inherit',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    </>
  );
}
