import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getCustomers } from '../api/customerApi';
import {
  createMeasurementSet,
  deleteMeasurementSet,
  listMeasurementSetsByCustomer,
  updateMeasurementSet,
} from '../api/measurementApi';
import { measurementDefinitions } from '../data/measurementDefinitions';
import type { Customer } from '../types/customer';
import type { MeasurementDefinition, MeasurementSet, MeasurementSetRequest } from '../types/measurement';

type Section = {
  title: string;
  from: number;
  to: number;
};

const sections: Section[] = [
  { title: 'Üst Beden', from: 1, to: 19 },
  { title: 'Sağ Bacak', from: 20, to: 25 },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value));
}

function valuesFromSet(set: MeasurementSet | null) {
  const values: Record<string, string> = {};
  set?.values.forEach((value) => {
    values[value.definitionKey] = String(value.numericValue);
  });
  return values;
}

export function MeasurementsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [measurementSets, setMeasurementSets] = useState<MeasurementSet[]>([]);
  const [editingSet, setEditingSet] = useState<MeasurementSet | null>(null);
  const [measuredAt, setMeasuredAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [previewDefinition, setPreviewDefinition] = useState<MeasurementDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedCustomer = customers.find((customer) => String(customer.id) === selectedCustomerId) ?? null;

  const enteredCount = useMemo(
    () => measurementDefinitions.filter((definition) => values[definition.key]?.trim()).length,
    [values],
  );
  const missingCount = measurementDefinitions.length - enteredCount;

  const filteredSections = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR');
    return sections.map((section) => ({
      ...section,
      definitions: measurementDefinitions.filter((definition) => {
        const inSection = definition.order >= section.from && definition.order <= section.to;
        const matchesSearch = !normalizedSearch || definition.label.toLocaleLowerCase('tr-TR').includes(normalizedSearch);
        return inSection && matchesSearch;
      }),
    }));
  }, [search]);

  async function loadCustomers() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCustomers();
      setCustomers(response);
      if (response.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(String(response[0].id));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Müşteriler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSets(customerId: string) {
    if (!customerId) {
      setMeasurementSets([]);
      return;
    }
    setError(null);
    try {
      setMeasurementSets(await listMeasurementSetsByCustomer(Number(customerId)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ölçü setleri yüklenemedi.');
    }
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  useEffect(() => {
    void loadSets(selectedCustomerId);
    startNewSet(false);
  }, [selectedCustomerId]);

  function startNewSet(clearMessage = true) {
    setEditingSet(null);
    setMeasuredAt(today());
    setNotes('');
    setValues({});
    if (clearMessage) {
      setError(null);
      setSuccess(null);
    }
  }

  function openSet(set: MeasurementSet) {
    setEditingSet(set);
    setMeasuredAt(set.measuredAt ?? today());
    setNotes(set.notes ?? '');
    setValues(valuesFromSet(set));
    setError(null);
    setSuccess(null);
  }

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setError(null);
    setSuccess(null);
  }

  function payload(): MeasurementSetRequest {
    return {
      customerId: Number(selectedCustomerId),
      measuredAt,
      notes: notes.trim() || undefined,
      values: measurementDefinitions
        .filter((definition) => values[definition.key]?.trim())
        .map((definition) => ({
          definitionKey: definition.key,
          definitionOrder: definition.order,
          definitionLabel: definition.label,
          numericValue: Number(values[definition.key]),
          unit: definition.unit,
        })),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedCustomerId) {
      setError('Müşteri seçimi zorunludur.');
      return;
    }

    const invalidValue = Object.values(values).find((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) <= 0));
    if (invalidValue) {
      setError('Girilen ölçü değerleri pozitif sayı olmalıdır.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingSet) {
        const updated = await updateMeasurementSet(editingSet.id, payload());
        setEditingSet(updated);
        setSuccess('Ölçü seti güncellendi.');
      } else {
        const created = await createMeasurementSet(payload());
        setEditingSet(created);
        setSuccess('Ölçü seti kaydedildi.');
      }
      await loadSets(selectedCustomerId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ölçü seti kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(set: MeasurementSet) {
    if (!window.confirm('Bu ölçü setini silmek istediğinize emin misiniz?')) {
      return;
    }
    try {
      await deleteMeasurementSet(set.id);
      setSuccess('Ölçü seti silindi.');
      startNewSet(false);
      await loadSets(selectedCustomerId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ölçü seti silinemedi.');
    }
  }

  return (
    <section className="measurements-page">
      <div className="page-header">
        <div className="section-heading">
          <span className="eyebrow">Detaylı ölçü stüdyosu</span>
          <h2>Ölçüler</h2>
          <p>Müşteri seçin, referans görseller eşliğinde 25 ölçüyü düzenli bir set olarak kaydedin.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => startNewSet()}>Yeni Ölçü Seti</button>
      </div>

      {error && <div className="state-message error dashboard-state">{error}</div>}
      {success && <div className="state-message success dashboard-state">{success}</div>}

      <div className="measurement-workspace">
        <aside className="surface-card measurement-sidebar">
          <label className="field">
            <span>Müşteri Seç</span>
            <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)} disabled={isLoading}>
              <option value="">Müşteri seçin</option>
              {customers.map((customer) => (
                <option value={customer.id} key={customer.id}>{customer.firstName} {customer.lastName}</option>
              ))}
            </select>
          </label>

          {selectedCustomer && (
            <div className="customer-quick-info">
              <span>Seçili müşteri</span>
              <strong>{selectedCustomer.firstName} {selectedCustomer.lastName}</strong>
              <small>{selectedCustomer.phone}</small>
              <small>Boy: {selectedCustomer.heightCm ?? '-'} cm · Kilo: {selectedCustomer.weightKg ?? '-'} kg</small>
            </div>
          )}

          <div className="measurement-progress">
            <div>
              <span>Ölçü ilerlemesi</span>
              <strong>{enteredCount} / {measurementDefinitions.length}</strong>
            </div>
            <div className="workload-meter"><i style={{ width: `${(enteredCount / measurementDefinitions.length) * 100}%` }} /></div>
            <small>Eksik Ölçüler: {missingCount}</small>
          </div>

          <div className="measurement-history">
            <div className="section-header">
              <div>
                <span className="eyebrow">Geçmiş</span>
                <h2>Ölçü Setleri</h2>
              </div>
            </div>
            {measurementSets.length === 0 ? (
              <div className="state-message">Bu müşteri için kayıtlı ölçü seti yok.</div>
            ) : (
              measurementSets.map((set) => (
                <button
                  className={editingSet?.id === set.id ? 'measurement-set-button active' : 'measurement-set-button'}
                  type="button"
                  key={set.id}
                  onClick={() => openSet(set)}
                >
                  <strong>{formatDate(set.measuredAt)}</strong>
                  <span>{set.values.length} ölçü kaydı</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <form className="surface-card measurement-form-panel" onSubmit={handleSubmit}>
          <div className="measurement-toolbar">
            <label className="field">
              <span>Ölçüm Tarihi</span>
              <input type="date" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} />
            </label>
            <label className="field">
              <span>Ölçü Ara</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ölçü adı yazın" />
            </label>
          </div>

          <label className="field">
            <span>Genel Not</span>
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          {filteredSections.map((section) => (
            <section className="measurement-section" key={section.title}>
              <div className="section-header">
                <div>
                  <span className="eyebrow">{section.from}-{section.to}</span>
                  <h2>{section.title}</h2>
                </div>
              </div>
              <div className="measurement-card-grid">
                {section.definitions.map((definition) => (
                  <article className="measurement-card" key={definition.key}>
                    <div className="measurement-card-header">
                      <span>{definition.order}</span>
                      <strong>{definition.label}</strong>
                    </div>
                    <button className="measurement-image-button" type="button" onClick={() => setPreviewDefinition(definition)}>
                      {definition.imageSrc ? <img src={definition.imageSrc} alt={definition.label} /> : <span>Görsel yok</span>}
                    </button>
                    <div className="measurement-card-body">
                      <label>
                        <span>Ölçü Değeri</span>
                        <div className="measurement-value-field">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            inputMode="decimal"
                            placeholder="Örn. 42.5"
                            value={values[definition.key] ?? ''}
                            onChange={(event) => updateValue(definition.key, event.target.value)}
                          />
                          <em>{definition.unit}</em>
                        </div>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <div className="form-actions measurement-actions">
            {editingSet && (
              <button className="danger-button" type="button" onClick={() => void handleDelete(editingSet)}>Ölçü Setini Sil</button>
            )}
            <button className="primary-button" type="submit" disabled={isSaving || !selectedCustomerId}>
              {isSaving ? 'Kaydediliyor...' : editingSet ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>

      {previewDefinition && (
        <div className="measurement-preview" role="dialog" aria-modal="true">
          <div className="measurement-preview-panel">
            <button className="ghost-button small-button" type="button" onClick={() => setPreviewDefinition(null)}>Kapat</button>
            <strong>{previewDefinition.order}. {previewDefinition.label}</strong>
            {previewDefinition.imageSrc && <img src={previewDefinition.imageSrc} alt={previewDefinition.label} />}
          </div>
        </div>
      )}
    </section>
  );
}
