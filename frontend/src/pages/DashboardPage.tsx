import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminDashboard } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import type { AdminDashboardResponse, StageWorkloadResponse } from '../types/dashboard';

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
  }).format(new Date(value));
}

function maxStageCount(stages: StageWorkloadResponse[]) {
  return Math.max(1, ...stages.map((stage) => stage.jobCount));
}

function EmployeeDashboard() {
  const { user, hasRole } = useAuth();
  const canSeeCustomers = hasRole('ADMIN', 'SALES');

  return (
    <div className="dashboard-page employee-dashboard">
      <section className="admin-page-header">
        <div>
          <span className="eyebrow">Operasyon</span>
          <h2>Atölye Paneli</h2>
          <p>Size tanımlı rol kapsamında üretim akışını ve günlük çalışma alanınızı takip edin.</p>
        </div>
      </section>

      <section className="welcome-card">
        <div>
          <span className="kicker">Hoş geldiniz</span>
          <h3>Hoş geldiniz, {user?.fullName ?? 'Atölye Ekibi'}</h3>
          <p className="dashboard-role-line">{user?.roleLabel}</p>
          <p>
            Üretim hattındaki işleri izleyebilir, yetkiniz dahilindeki müşteri ve ölçü kayıtlarına ulaşabilirsiniz.
          </p>
        </div>
        <Link className="button button-gold" to="/admin/workflow">
          Üretim Takibini Aç
        </Link>
      </section>

      <section className="employee-action-grid">
        <Link className="quick-action active" to="/admin/workflow">
          <span>Üretim Takibini Aç</span>
          <strong>Kanban panosuna git</strong>
        </Link>
        {canSeeCustomers && (
          <Link className="quick-action active" to="/admin/customers">
            <span>Müşteri Defterini Aç</span>
            <strong>Müşteri kayıtlarını yönet</strong>
          </Link>
        )}
        <Link className="quick-action active" to="/admin/change-password">
          <span>Şifre Değiştir</span>
          <strong>Oturum güvenliğini güncelle</strong>
        </Link>
      </section>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(user?.role === 'ADMIN');
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        setDashboard(await getAdminDashboard());
      } catch {
        setError('Dashboard verileri yüklenirken bir sorun oluştu.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, [isAdmin]);

  const stageMax = useMemo(() => maxStageCount(dashboard?.stageWorkload ?? []), [dashboard]);
  const employeeMax = useMemo(
    () => Math.max(1, ...(dashboard?.employeeWorkload.map((employee) => employee.activeJobCount) ?? [])),
    [dashboard],
  );

  if (!isAdmin) {
    return <EmployeeDashboard />;
  }

  return (
    <div className="dashboard-page admin-dashboard">
      <section className="admin-page-header dashboard-hero">
        <div>
          <span className="eyebrow">Yönetici görünümü</span>
          <h2>Atölye Komuta Merkezi</h2>
          <p>Atölye, müşteri ve üretim hattının genel performansını tek ekrandan takip edin.</p>
          <p className="dashboard-role-line">Hoş geldiniz, {user?.fullName ?? 'Erdal Güda'}</p>
        </div>
        <div className="dashboard-hero-actions">
          <Link className="button button-gold" to="/admin/workflow">Üretim Takibini Aç</Link>
          <Link className="ghost-button" to="/admin/customers">Yeni Müşteri Ekle</Link>
        </div>
      </section>

      {error && <div className="state-message error dashboard-state">{error}</div>}
      {isLoading && <div className="state-message loading-state dashboard-state">Dashboard verileri yükleniyor...</div>}

      {dashboard && !isLoading && (
        <>
          <section className="admin-metric-grid" aria-label="Yönetici metrikleri">
            {dashboard.mainMetrics.map((metric) => (
              <article className={metric.key === 'overdueJobs' && metric.value > 0 ? 'admin-metric-card warning' : 'admin-metric-card'} key={metric.key}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </section>

          <section className="dashboard-report-grid">
            <article className="surface-card report-card stage-report-card">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Üretim hattı</span>
                  <h2>Aşama Yoğunluğu</h2>
                </div>
              </div>
              <div className="stage-workload-list">
                {dashboard.stageWorkload.map((stage) => (
                  <div className="workload-row" key={`${stage.stageOrder}-${stage.stageName}`}>
                    <div className="workload-row-info">
                      <span>{stage.stageOrder}</span>
                      <div>
                        <strong>{stage.stageName}</strong>
                        <small>{stage.responsibleEmployeeName ?? 'Sorumlu atanmadı'}</small>
                      </div>
                    </div>
                    <div className="workload-meter" aria-label={`${stage.jobCount} iş`}>
                      <i style={{ width: `${Math.max(4, (stage.jobCount / stageMax) * 100)}%` }} />
                    </div>
                    <strong className="workload-count">{stage.jobCount}</strong>
                  </div>
                ))}
              </div>
            </article>

            <aside className="surface-card report-card quick-actions-card">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Kısayollar</span>
                  <h2>Hızlı İşlemler</h2>
                </div>
              </div>
              <div className="quick-actions">
                <Link className="quick-action active" to="/admin/workflow">
                  <span>Üretim Takibini Aç</span>
                  <strong>Kanban panosuna git</strong>
                </Link>
                <Link className="quick-action active" to="/admin/customers">
                  <span>Yeni Müşteri Ekle</span>
                  <strong>Müşteri defterini aç</strong>
                </Link>
                <Link className="quick-action active" to="/admin/users">
                  <span>Kullanıcıları Yönet</span>
                  <strong>Şifre sıfırlama ve liste</strong>
                </Link>
                <Link className="quick-action active" to="/admin/change-password">
                  <span>Şifre Değiştir</span>
                  <strong>Oturum güvenliğini güncelle</strong>
                </Link>
              </div>
            </aside>
          </section>

          <section className="dashboard-distribution-grid">
            <article className="surface-card report-card">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Ürün dağılımı</span>
                  <h2>Ürün Grupları</h2>
                </div>
              </div>
              <div className="distribution-grid">
                {dashboard.productTypeDistribution.map((item) => (
                  <div className="distribution-card" key={item.productType}>
                    <span>{item.productTypeLabel}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="surface-card report-card">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Öncelik</span>
                  <h2>İş Öncelikleri</h2>
                </div>
              </div>
              <div className="priority-list">
                {dashboard.priorityDistribution.map((item) => (
                  <div className={`priority-row priority-${item.priority.toLowerCase()}`} key={item.priority}>
                    <span>{item.priorityLabel}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="dashboard-report-grid">
            <article className="surface-card report-card">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Ekip yükü</span>
                  <h2>Çalışan İş Yoğunluğu</h2>
                </div>
              </div>
              <div className="employee-workload-list">
                {dashboard.employeeWorkload.map((employee) => (
                  <div className="employee-workload-row" key={employee.employeeId}>
                    <div>
                      <strong>{employee.employeeName}</strong>
                      <span>{employee.roleTitle}</span>
                    </div>
                    <div className="workload-meter">
                      <i style={{ width: `${Math.max(4, (employee.activeJobCount / employeeMax) * 100)}%` }} />
                    </div>
                    <strong>{employee.activeJobCount} iş</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="surface-card report-card">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Altı aylık trend</span>
                  <h2>Aylık Hareket</h2>
                </div>
              </div>
              <div className="monthly-trend-list">
                {dashboard.monthlyTrend.map((month) => (
                  <div className="trend-row" key={month.month}>
                    <span>{month.month}</span>
                    <strong>{month.customerCount} müşteri</strong>
                    <strong>{month.productionJobCount} üretim işi</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="surface-card report-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Son üretim işleri</span>
                <h2>Üretim Hareketleri</h2>
              </div>
              <Link className="ghost-button small-button" to="/admin/workflow">Panoyu Aç</Link>
            </div>
            <div className="table-wrap refined-table-wrap">
              <table className="data-table dashboard-table">
                <thead>
                  <tr>
                    <th>İş No</th>
                    <th>Müşteri</th>
                    <th>Ürün</th>
                    <th>Aşama</th>
                    <th>Sorumlu</th>
                    <th>Öncelik</th>
                    <th>Teslim</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentProductionJobs.map((job) => (
                    <tr key={job.id}>
                      <td><strong>{job.jobNumber}</strong></td>
                      <td>{job.customerFullName}</td>
                      <td>{job.productTypeLabel}</td>
                      <td>{job.currentStageName}</td>
                      <td>{job.assignedEmployeeName}</td>
                      <td><span className="status-pill">{job.priorityLabel}</span></td>
                      <td>{formatDate(job.expectedDeliveryDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface-card report-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Son müşteriler</span>
                <h2>Müşteri Hareketleri</h2>
              </div>
              <Link className="ghost-button small-button" to="/admin/customers">Müşteri Defteri</Link>
            </div>
            <div className="recent-customer-grid">
              {dashboard.recentCustomers.length === 0 ? (
                <div className="empty-state compact-empty">Henüz müşteri kaydı bulunmuyor.</div>
              ) : dashboard.recentCustomers.map((customer) => (
                <article className="recent-customer-card" key={customer.id}>
                  <strong>{customer.fullName}</strong>
                  <span>{customer.phone ?? '-'}</span>
                  <small>{formatDateTime(customer.createdAt)}</small>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
