import { useEffect, useMemo, useState } from 'react';
import {
  AppointmentResponse,
  AppointmentStatus,
  deleteAppointment,
  getAppointments,
  getAppointmentStatusLabel,
  updateAppointmentStatus,
} from '../api/appointmentApi';

const STATUS_OPTIONS: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      setAppointments(await getAppointments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Randevular yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return appointments;
    return appointments.filter((appointment) => appointment.status === filter);
  }, [appointments, filter]);

  const summary = useMemo(() => ({
    total: appointments.length,
    pending: appointments.filter((a) => a.status === 'PENDING').length,
    confirmed: appointments.filter((a) => a.status === 'CONFIRMED').length,
    completed: appointments.filter((a) => a.status === 'COMPLETED').length,
  }), [appointments]);

  async function changeStatus(id: number, status: AppointmentStatus) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await updateAppointmentStatus(id, { status });
      setAppointments((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Randevu güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Bu randevu kaydını silmek istediğinize emin misiniz?')) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteAppointment(id);
      setAppointments((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Randevu silinemedi.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="appointments-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">Müşteri talepleri</span>
          <h2>Randevular</h2>
          <p>Ziyaretçi sayfasından gelen randevu taleplerini buradan yönetin.</p>
        </div>
      </header>

      <section className="admin-metric-grid" aria-label="Randevu özeti">
        <article className="admin-metric-card">
          <span>Toplam Talep</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="admin-metric-card">
          <span>Bekleyen</span>
          <strong>{summary.pending}</strong>
        </article>
        <article className="admin-metric-card">
          <span>Onaylanan</span>
          <strong>{summary.confirmed}</strong>
        </article>
        <article className="admin-metric-card">
          <span>Tamamlanan</span>
          <strong>{summary.completed}</strong>
        </article>
      </section>

      <div className="appointments-filter-bar">
        <button
          type="button"
          className={filter === 'ALL' ? 'ghost-button small-button active' : 'ghost-button small-button'}
          onClick={() => setFilter('ALL')}
        >
          Tümü
        </button>
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={filter === option ? 'ghost-button small-button active' : 'ghost-button small-button'}
            onClick={() => setFilter(option)}
          >
            {getAppointmentStatusLabel(option)}
          </button>
        ))}
      </div>

      {error && <div className="state-message error" role="alert">{error}</div>}

      {isLoading ? (
        <div className="state-message loading-state">Randevular yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div className="state-message">
          {filter === 'ALL' ? 'Henüz randevu talebi bulunmuyor.' : 'Bu duruma uygun randevu bulunamadı.'}
        </div>
      ) : (
        <div className="appointments-list">
          {filtered.map((appointment) => (
            <article className="appointment-card" key={appointment.id}>
              <div className="appointment-card-topline">
                <div>
                  <strong>{appointment.fullName}</strong>
                  <span>{appointment.phone}</span>
                </div>
                <span className={`status-pill status-${appointment.status.toLowerCase()}`}>
                  {getAppointmentStatusLabel(appointment.status)}
                </span>
              </div>
              <div className="appointment-card-meta">
                {appointment.email && <span>{appointment.email}</span>}
                {appointment.requestedService && <span>Hizmet: {appointment.requestedService}</span>}
                <span>Tercih: {formatDate(appointment.preferredDate)}</span>
                <span>Talep: {formatDateTime(appointment.createdAt)}</span>
              </div>
              {appointment.notes && <p className="appointment-card-notes">{appointment.notes}</p>}
              <div className="appointment-card-actions">
                <label className="appointment-status-select">
                  <span>Durum</span>
                  <select
                    value={appointment.status}
                    onChange={(event) => changeStatus(appointment.id, event.target.value as AppointmentStatus)}
                    disabled={busyId === appointment.id}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{getAppointmentStatusLabel(option)}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="danger-button small-button"
                  onClick={() => remove(appointment.id)}
                  disabled={busyId === appointment.id}
                >
                  Sil
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
