import { useEffect, useMemo, useState } from 'react';
import {
  createProductionJob,
  getProductionJobHistory,
  getProductionJobs,
  getProductionStages,
  moveProductionJob,
} from '../api/productionApi';
import { OrderDetailsDrawer } from '../components/OrderDetailsDrawer';
import { ProductionJobForm } from '../components/ProductionJobForm';
import { useAuth } from '../context/AuthContext';
import type {
  ProductionJob,
  ProductionJobHistory,
  ProductionJobRequest,
  ProductionStage,
} from '../types/production';
import {
  getActionTypeLabel,
  getJobStatusLabel,
  getPriorityLabel,
  getProductTypeLabel,
} from '../types/production';

type SummaryCardProps = {
  label: string;
  value: number;
};

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <article className="workflow-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getNotesPreview(notes: string | null) {
  if (!notes) {
    return null;
  }

  return notes.length > 96 ? `${notes.slice(0, 96)}...` : notes;
}

export function WorkflowPage() {
  const { hasRole } = useAuth();
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMovingJobId, setIsMovingJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detailJob, setDetailJob] = useState<ProductionJob | null>(null);
  const [historyJob, setHistoryJob] = useState<ProductionJob | null>(null);
  const [history, setHistory] = useState<ProductionJobHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  async function loadBoard() {
    setIsLoading(true);
    setError(null);

    try {
      const [stageResponse, jobResponse] = await Promise.all([
        getProductionStages(),
        getProductionJobs(),
      ]);

      setStages([...stageResponse].sort((a, b) => a.stageOrder - b.stageOrder));
      setJobs(jobResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Üretim panosu yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBoard();
  }, []);

  const jobsByStage = useMemo(() => {
    const grouped = new Map<number, ProductionJob[]>();

    stages.forEach((stage) => grouped.set(stage.id, []));
    jobs.forEach((job) => {
      const stageJobs = grouped.get(job.currentStage.id) ?? [];
      stageJobs.push(job);
      grouped.set(job.currentStage.id, stageJobs);
    });

    return grouped;
  }, [jobs, stages]);

  const summary = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter((job) => job.status === 'ACTIVE').length,
    revision: jobs.filter((job) => job.status === 'REVISION').length,
    completed: jobs.filter((job) => job.status === 'COMPLETED').length,
    urgent: jobs.filter((job) => job.priority === 'URGENT').length,
  }), [jobs]);
  const canCreateJob = hasRole('ADMIN', 'SALES');

  async function handleCreateJob(data: ProductionJobRequest) {
    setIsSubmitting(true);
    setError(null);

    try {
      await createProductionJob(data);
      setShowForm(false);
      await loadBoard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Üretim işi oluşturulamadı.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function moveJob(job: ProductionJob, direction: 'previous' | 'next') {
    const currentIndex = stages.findIndex((stage) => stage.id === job.currentStage.id);
    const targetStage = direction === 'next' ? stages[currentIndex + 1] : stages[currentIndex - 1];

    if (!targetStage) {
      return;
    }

    setIsMovingJobId(job.id);
    setError(null);

    try {
      await moveProductionJob(job.id, {
        toStageId: targetStage.id,
        performedByEmployeeId: job.assignedEmployee?.id,
        note: direction === 'next'
          ? 'Kanban ekranından sonraki aşamaya aktarıldı.'
          : 'Kanban ekranından önceki aşamaya geri alındı.',
      });
      await loadBoard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Üretim işi taşınamadı.');
    } finally {
      setIsMovingJobId(null);
    }
  }

  async function openHistory(job: ProductionJob) {
    setHistoryJob(job);
    setHistory([]);
    setHistoryError(null);
    setIsHistoryLoading(true);

    try {
      setHistory(await getProductionJobHistory(job.id));
    } catch (requestError) {
      setHistoryError(requestError instanceof Error ? requestError.message : 'Geçmiş bilgisi yüklenemedi.');
    } finally {
      setIsHistoryLoading(false);
    }
  }

  return (
    <section className="workflow-page">
      <div className="page-header">
        <div className="section-heading">
          <span className="eyebrow">Atölye üretim hattı</span>
          <h2>Üretim Takibi</h2>
          <p>Siparişlerin ölçüden teslimata kadar geçtiği tüm atölye ve fabrika aşamalarını takip edin.</p>
        </div>
        {canCreateJob && (
          <button className="primary-button" type="button" onClick={() => setShowForm(true)}>
            Yeni Üretim İşi
          </button>
        )}
      </div>

      {showForm && canCreateJob && (
        <ProductionJobForm
          isSubmitting={isSubmitting}
          onCancel={() => setShowForm(false)}
          onSubmit={handleCreateJob}
        />
      )}

      <section className="workflow-summary-strip" aria-label="Üretim özeti">
        <SummaryCard label="Toplam İş" value={summary.total} />
        <SummaryCard label="Aktif İş" value={summary.active} />
        <SummaryCard label="Revizedeki İşler" value={summary.revision} />
        <SummaryCard label="Tamamlanan İşler" value={summary.completed} />
        <SummaryCard label="Acil İşler" value={summary.urgent} />
      </section>

      {error && (
        <div className="state-message error" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="state-message loading-state">Üretim panosu yükleniyor...</div>
      ) : stages.length === 0 ? (
        <div className="empty-state">
          <span className="empty-mark">EG</span>
          <h3>Üretim aşaması bulunamadı</h3>
          <p>Kanban panosu için backend üretim aşamalarının tanımlanması gerekir.</p>
        </div>
      ) : (
        <div className="kanban-shell">
          {jobs.length === 0 && (
            <div className="workflow-empty-note">
              <strong>Henüz üretim işi bulunmuyor.</strong>
              <span>Yeni Üretim İşi butonu ile ilk işi oluşturabilirsiniz.</span>
            </div>
          )}

          <div className="kanban-board">
            {stages.map((stage) => {
              const stageJobs = jobsByStage.get(stage.id) ?? [];
              const isFirstStage = stage.stageOrder === 1;
              const isLastStage = stage.stageOrder === 15;

              return (
                <article className="kanban-column" key={stage.id}>
                  <div className="stage-header">
                    <div>
                      <span>{String(stage.stageOrder).padStart(2, '0')}</span>
                      <h3>{stage.name}</h3>
                    </div>
                    <strong>{stageJobs.length}</strong>
                  </div>
                  <p className="stage-owner">{stage.defaultResponsibleEmployee.fullName}</p>

                  <div className="job-card-list">
                    {stageJobs.map((job) => {
                      const notesPreview = getNotesPreview(job.notes);

                      return (
                        <article className="production-job-card" key={job.id}>
                          <div className="job-card-topline">
                            <strong>{job.jobNumber}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className={`priority-badge priority-${job.priority.toLowerCase()}`}>
                                {getPriorityLabel(job.priority)}
                              </span>
                              <button
                                className="ghost-button"
                                style={{ width: 28, height: 28, padding: 0, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                type="button"
                                title="Sipariş Detayını Gör"
                                onClick={() => setDetailJob(job)}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {job.relatedOrderNumber && <span className="order-link-pill">Sipariş: {job.relatedOrderNumber}</span>}
                          <h4>{job.customerFullName}</h4>
                          <div className="job-meta-grid">
                            <span>{getProductTypeLabel(job.productType)}</span>
                            <span className={`status-badge status-${job.status.toLowerCase()}`}>
                              {getJobStatusLabel(job.status)}
                            </span>
                            <span>Teslim: {formatDate(job.expectedDeliveryDate)}</span>
                            <span>{job.assignedEmployee?.fullName ?? 'Atama yok'}</span>
                          </div>
                          {notesPreview && <p>{notesPreview}</p>}
                          <div className="job-card-actions">
                            <button
                              className="ghost-button small-button"
                              type="button"
                              onClick={() => moveJob(job, 'previous')}
                              disabled={isFirstStage || isMovingJobId === job.id}
                            >
                              Önceki Aşama
                            </button>
                            <button
                              className="primary-button small-button"
                              type="button"
                              onClick={() => moveJob(job, 'next')}
                              disabled={isLastStage || isMovingJobId === job.id}
                            >
                              Sonraki Aşama
                            </button>
                            <button className="ghost-button small-button" type="button" onClick={() => openHistory(job)}>
                              Geçmiş
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {detailJob && (
        <OrderDetailsDrawer job={detailJob} onClose={() => setDetailJob(null)} />
      )}

      {historyJob && (
        <aside className="history-panel" aria-label="Üretim geçmişi">
          <div className="history-panel-header">
            <div>
              <span className="eyebrow">İş geçmişi</span>
              <h3>{historyJob.jobNumber}</h3>
              <p>{historyJob.customerFullName}</p>
            </div>
            <button className="ghost-button small-button" type="button" onClick={() => setHistoryJob(null)}>
              Kapat
            </button>
          </div>

          {historyError && (
            <div className="state-message error" role="alert">
              {historyError}
            </div>
          )}

          {isHistoryLoading ? (
            <div className="state-message loading-state">Geçmiş yükleniyor...</div>
          ) : history.length === 0 ? (
            <div className="state-message">Bu üretim işi için henüz geçmiş kaydı bulunmuyor.</div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <article className="history-item" key={item.id}>
                  <span>{getActionTypeLabel(item.actionType)}</span>
                  <strong>
                    {item.fromStage?.name ?? 'Başlangıç'} → {item.toStage?.name ?? '-'}
                  </strong>
                  <p>{item.note || 'Not eklenmedi.'}</p>
                  <small>
                    {item.performedByEmployee?.fullName ?? 'Sistem'} · {formatDateTime(item.createdAt)}
                  </small>
                </article>
              ))}
            </div>
          )}
        </aside>
      )}
    </section>
  );
}
