import { FormEvent, useEffect, useState } from 'react';
import { createVipCustomer, getUsers, resetUserPassword } from '../../api/userApi';
import type { VipCustomerRequest } from '../../api/userApi';
import type { UserResponse } from '../../types/auth';

export function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // VIP form state
  const [showVipForm, setShowVipForm] = useState(false);
  const [vipForm, setVipForm] = useState<VipCustomerRequest>({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });
  const [isCreatingVip, setIsCreatingVip] = useState(false);
  const [vipError, setVipError] = useState<string | null>(null);
  const [vipSuccess, setVipSuccess] = useState<string | null>(null);

  async function loadUsers() {
    setIsLoading(true);
    setError(null);

    try {
      setUsers(await getUsers());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kullanıcılar yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleReset(user: UserResponse) {
    const confirmed = window.confirm('Bu kullanıcının şifresi erdalguda123 olarak sıfırlanacak. Emin misiniz?');

    if (!confirmed) {
      return;
    }

    setResettingUserId(user.id);
    setError(null);
    setSuccess(null);

    try {
      await resetUserPassword(user.id);
      setSuccess(`${user.fullName} için şifre sıfırlandı.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Şifre sıfırlanamadı.');
    } finally {
      setResettingUserId(null);
    }
  }

  async function handleCreateVip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVipError(null);
    setVipSuccess(null);

    if (!vipForm.username.trim()) {
      setVipError('Kullanıcı adı zorunludur.');
      return;
    }
    if (!vipForm.password.trim()) {
      setVipError('Şifre zorunludur.');
      return;
    }
    if (!vipForm.firstName.trim()) {
      setVipError('Ad zorunludur.');
      return;
    }
    if (!vipForm.lastName.trim()) {
      setVipError('Soyad zorunludur.');
      return;
    }

    setIsCreatingVip(true);
    try {
      const result = await createVipCustomer({
        username: vipForm.username.trim(),
        password: vipForm.password.trim(),
        firstName: vipForm.firstName.trim(),
        lastName: vipForm.lastName.trim(),
        phone: vipForm.phone?.trim() || undefined,
        email: vipForm.email?.trim() || undefined,
      });
      setVipSuccess(`VIP müşteri oluşturuldu: ${result.fullName} (Müşteri ID: ${result.customerId})`);
      setVipForm({ username: '', password: '', firstName: '', lastName: '', phone: '', email: '' });
      void loadUsers();
    } catch (requestError) {
      setVipError(requestError instanceof Error ? requestError.message : 'VIP müşteri oluşturulamadı.');
    } finally {
      setIsCreatingVip(false);
    }
  }

  function updateVipField(field: keyof VipCustomerRequest, value: string) {
    setVipForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <section className="users-page">
      <div className="page-header">
        <div className="section-heading">
          <span className="eyebrow">Yönetici işlemleri</span>
          <h2>Kullanıcılar</h2>
          <p>Aktif panel kullanıcılarını görüntüleyin ve gerekli durumlarda şifrelerini sıfırlayın.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setShowVipForm((prev) => !prev);
            setVipError(null);
            setVipSuccess(null);
          }}
        >
          {showVipForm ? 'Formu Kapat' : 'VIP Müşteri Oluştur'}
        </button>
      </div>

      {showVipForm && (
        <div className="surface-card" style={{ marginBottom: '24px', padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <span className="eyebrow">Yeni kayıt</span>
            <h3 style={{ margin: '4px 0 0' }}>VIP Müşteri Oluştur</h3>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary, #666)' }}>
              Müşteri için bir portal hesabı oluşturun. Müşteri kendi siparişlerini ve ölçülerini görebilir.
            </p>
          </div>

          {vipError && <div className="state-message error" style={{ marginBottom: '16px' }}>{vipError}</div>}
          {vipSuccess && <div className="state-message success" style={{ marginBottom: '16px' }}>{vipSuccess}</div>}

          <form onSubmit={(e) => void handleCreateVip(e)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Ad *</span>
                <input
                  value={vipForm.firstName}
                  onChange={(e) => updateVipField('firstName', e.target.value)}
                  placeholder="Müşteri adı"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Soyad *</span>
                <input
                  value={vipForm.lastName}
                  onChange={(e) => updateVipField('lastName', e.target.value)}
                  placeholder="Müşteri soyadı"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Kullanıcı Adı *</span>
                <input
                  value={vipForm.username}
                  onChange={(e) => updateVipField('username', e.target.value)}
                  placeholder="portal_kullanici_adi"
                  autoComplete="off"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Şifre *</span>
                <input
                  type="password"
                  value={vipForm.password}
                  onChange={(e) => updateVipField('password', e.target.value)}
                  placeholder="Güçlü bir şifre girin"
                  autoComplete="new-password"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Telefon</span>
                <input
                  value={vipForm.phone}
                  onChange={(e) => updateVipField('phone', e.target.value)}
                  placeholder="+90 5xx xxx xx xx"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>E-posta</span>
                <input
                  type="email"
                  value={vipForm.email}
                  onChange={(e) => updateVipField('email', e.target.value)}
                  placeholder="musteri@ornek.com"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #ddd)', fontSize: '14px' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="primary-button" type="submit" disabled={isCreatingVip}>
                {isCreatingVip ? 'Oluşturuluyor...' : 'VIP Müşteri Oluştur'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setShowVipForm(false);
                  setVipError(null);
                  setVipSuccess(null);
                }}
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="surface-card table-card users-table-card">
        <div className="section-header table-card-header">
          <div>
            <span className="eyebrow">Kullanıcı listesi</span>
            <h2>Aktif Kullanıcılar</h2>
          </div>
          <span className="count-badge">{users.length} kullanıcı</span>
        </div>

        {error && <div className="state-message error">{error}</div>}
        {success && <div className="state-message success">{success}</div>}

        {isLoading ? (
          <div className="state-message loading-state">Kullanıcılar yükleniyor...</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table users-table">
              <thead>
                <tr>
                  <th>Kullanıcı Adı</th>
                  <th>Ad Soyad</th>
                  <th>Rol</th>
                  <th>Çalışan</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.username}</strong>
                    </td>
                    <td>{user.fullName}</td>
                    <td>{user.roleLabel}</td>
                    <td>{user.employeeName ?? '-'}</td>
                    <td>
                      <span className="status-pill">{user.active ? 'Aktif' : 'Pasif'}</span>
                    </td>
                    <td>
                      <button
                        className="secondary-button table-action-button"
                        type="button"
                        disabled={resettingUserId === user.id}
                        onClick={() => void handleReset(user)}
                      >
                        {resettingUserId === user.id ? 'Sıfırlanıyor...' : 'Şifreyi Sıfırla'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
