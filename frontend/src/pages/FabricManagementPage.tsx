import { useEffect, useRef, useState } from 'react';
import {
  type FabricResponse,
  type FabricUpdateRequest,
  type GarmentType,
  deleteFabric,
  generateFabric,
  getFabrics,
  updateFabric,
} from '../api/fabricApi';
import { PrintLabelModal } from '../components/PrintLabelModal';

// ---------------------------------------------------------------------------
// Upload form
// ---------------------------------------------------------------------------

interface UploadFormProps {
  garmentType: GarmentType;
  onSuccess: () => void;
}

function UploadForm({ garmentType, onSuccess }: UploadFormProps) {
  const [uploadName, setUploadName] = useState('');
  const [uploadTag, setUploadTag] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null | undefined) {
    if (!f || !f.type.startsWith('image/')) return;
    setUploadFile(f);
    setUploadPreview(URL.createObjectURL(f));
    setUploadStatus('idle');
    setUploadError('');
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadName.trim() || uploadStatus === 'loading') return;

    setUploadStatus('loading');
    setUploadError('');

    try {
      const data = await generateFabric({
        name: uploadName.trim(),
        file: uploadFile,
        tag: uploadTag.trim(),
        garmentType,
      });
      if (!data.ok) throw new Error(data.detail ?? 'Oluşturma başarısız');

      setUploadStatus('success');
      setUploadName('');
      setUploadTag('');
      setUploadFile(null);
      setUploadPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess();
    } catch (err) {
      setUploadStatus('error');
      setUploadError(err instanceof Error ? err.message : 'Oluşturma başarısız');
    }
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        Yeni Kumaş Ekle
      </p>
      <form
        style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
        onSubmit={(e) => void handleUpload(e)}
      >
        {/* Drop zone */}
        <div
          style={{
            position: 'relative',
            width: 72,
            height: 72,
            flexShrink: 0,
            border: `1.5px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 10,
            background: isDragging ? 'var(--bg-elevated)' : 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); pickFile(e.dataTransfer.files[0]); }}
        >
          {uploadPreview ? (
            <img src={uploadPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.5, padding: 4, pointerEvents: 'none' }}>
              Görsel<br />seçin
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 160 }}>
          <input
            type="text"
            placeholder="Kumaş adı *"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            disabled={uploadStatus === 'loading'}
            style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, font: 'inherit', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          />
          <input
            type="text"
            placeholder="Etiket (Yün, Pamuk…)"
            value={uploadTag}
            onChange={(e) => setUploadTag(e.target.value)}
            disabled={uploadStatus === 'loading'}
            style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, font: 'inherit', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          />
        </div>

        <button
          type="submit"
          disabled={!uploadFile || !uploadName.trim() || uploadStatus === 'loading'}
          style={{
            height: 38,
            padding: '0 16px',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            border: 'none',
            borderRadius: 8,
            font: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            opacity: (!uploadFile || !uploadName.trim() || uploadStatus === 'loading') ? 0.5 : 1,
          }}
        >
          {uploadStatus === 'loading' ? 'Oluşturuluyor…' : 'Yükle'}
        </button>
      </form>
      {uploadStatus === 'error' && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#c00' }}>{uploadError}</p>
      )}
      {uploadStatus === 'success' && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#167a16' }}>Tamamlandı — kumaş eklendi!</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline edit form
// ---------------------------------------------------------------------------

interface EditFormProps {
  fabric: FabricResponse;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({ fabric, onSave, onCancel }: EditFormProps) {
  const [name, setName] = useState(fabric.name);
  const [tag, setTag] = useState(fabric.tag ?? '');
  const [inStock, setInStock] = useState(fabric.inStock);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const req: FabricUpdateRequest = {
        name: name.trim(),
        tag: tag.trim() || null,
        inStock,
        type: fabric.type,
      };
      await updateFabric(fabric.fabricId, req);
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydetme başarısız');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Kumaş adı"
        style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, font: 'inherit', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-primary)' }}
      />
      <input
        type="text"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Etiket (Yün, Pamuk…)"
        style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, font: 'inherit', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-primary)' }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)' }}>
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
          style={{ width: 15, height: 15, cursor: 'pointer' }}
        />
        Stokta mevcut
      </label>
      {error && <p style={{ margin: 0, fontSize: 12, color: '#c00' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={saving}
          style={{ flex: 1, padding: '6px 0', background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 6, font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ flex: 1, padding: '6px 0', background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, font: 'inherit', fontSize: 12, cursor: 'pointer' }}
        >
          İptal
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Fabric card
// ---------------------------------------------------------------------------

interface FabricCardProps {
  fabric: FabricResponse;
  onDeleted: () => void;
  onUpdated: () => void;
}

function FabricCard({ fabric, onDeleted, onUpdated }: FabricCardProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showLabel, setShowLabel] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`"${fabric.name}" kumaşını silmek istiyor musunuz?`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFabric(fabric.fabricId);
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Silme başarısız');
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        border: '1.5px solid var(--border)',
        borderRadius: 12,
        background: 'var(--bg-card)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: deleting ? 0.5 : 1,
      }}
    >
      {/* Swatch */}
      <div style={{ width: '100%', aspectRatio: '1', background: 'var(--bg-elevated)', position: 'relative', overflow: 'hidden' }}>
        <img
          src={fabric.swatchUrl}
          alt={fabric.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        {/* Badges */}
        <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {fabric.defaultFabric && (
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-text)' }}>
              Varsayılan
            </span>
          )}
          {!fabric.inStock && (
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 999, background: 'rgba(224,85,85,0.2)', color: 'var(--danger)' }}>
              Stokta Yok
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fabric.name}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 10, fontFamily: 'monospace', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fabric.fabricId}
        </p>
        {fabric.tag && (
          <span style={{ display: 'inline-block', marginTop: 5, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            {fabric.tag}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px' }}>
        <button
          type="button"
          onClick={() => setShowLabel(true)}
          style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer' }}
          title="QR Etiket Yazdır"
        >
          QR
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          style={{ flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: editing ? 'var(--bg-elevated)' : 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          ✏ Düzenle
        </button>
        {!fabric.defaultFabric && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            style={{ flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600, border: '1px solid var(--danger)', borderRadius: 6, background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}
          >
            Sil
          </button>
        )}
      </div>
      {deleteError && (
        <p style={{ margin: 0, padding: '6px 12px 10px', fontSize: 11, color: 'var(--danger)' }}>
          {deleteError}
        </p>
      )}

      {/* Inline edit form */}
      {editing && (
        <EditForm
          fabric={fabric}
          onSave={() => { setEditing(false); onUpdated(); }}
          onCancel={() => setEditing(false)}
        />
      )}

      {showLabel && (
        <PrintLabelModal
          type="fabric"
          id={fabric.fabricId}
          title={fabric.name}
          subtitle={fabric.tag ?? undefined}
          onClose={() => setShowLabel(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab panel
// ---------------------------------------------------------------------------

interface TabPanelProps {
  garmentType: GarmentType;
}

function TabPanel({ garmentType }: TabPanelProps) {
  const [fabrics, setFabrics] = useState<FabricResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      setFabrics(await getFabrics(garmentType));
    } catch {
      setError('Kumaş listesi yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void load(); }, [garmentType]);

  return (
    <>
      <UploadForm garmentType={garmentType} onSuccess={() => void load()} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Kayıtlı Kumaşlar
        </p>
        {!isLoading && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)' }}>{fabrics.length} kumaş</span>
        )}
      </div>

      {error && <div className="state-message error dashboard-state">{error}</div>}

      {isLoading ? (
        <div className="state-message loading-state">Yükleniyor…</div>
      ) : fabrics.length === 0 ? (
        <div className="empty-state">Henüz kumaş kaydı yok.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {fabrics.map((fabric) => (
            <FabricCard
              key={fabric.fabricId}
              fabric={fabric}
              onDeleted={() => void load()}
              onUpdated={() => void load()}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function FabricManagementPage() {
  const [activeTab, setActiveTab] = useState<GarmentType>('JACKET');

  const tabs: { key: GarmentType; label: string }[] = [
    { key: 'JACKET', label: 'Ceket Kumaşları' },
    { key: 'SHIRT', label: 'Gömlek Kumaşları' },
  ];

  return (
    <section className="fabric-management-page">
      <div className="page-header">
        <div className="section-heading">
          <span className="eyebrow">Kumaş Yönetimi</span>
          <h2>Kumaş Kütüphanesi</h2>
          <p>Özel kumaş görseli yükleyin ve mevcut kumaş kataloğunu yönetin.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              font: 'inherit',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="surface-card" style={{ padding: 24 }}>
        <TabPanel key={activeTab} garmentType={activeTab} />
      </div>
    </section>
  );
}
