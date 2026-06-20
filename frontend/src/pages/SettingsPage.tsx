import { FormEvent, useEffect, useState } from 'react';
import { changePassword } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

const PREFERENCES_STORAGE_KEY = 'erdal_guda_settings_v1';

type NotificationPrefs = {
  emailOrders: boolean;
  emailAppointments: boolean;
  smsCritical: boolean;
  weeklyDigest: boolean;
};

type SystemPrefs = {
  language: 'tr' | 'en';
  theme: 'auto' | 'light' | 'dark';
  currency: 'TRY' | 'USD' | 'EUR';
  dateFormat: 'dd.MM.yyyy' | 'yyyy-MM-dd';
};

type Preferences = {
  notifications: NotificationPrefs;
  system: SystemPrefs;
};

const DEFAULT_PREFS: Preferences = {
  notifications: {
    emailOrders: true,
    emailAppointments: true,
    smsCritical: false,
    weeklyDigest: true,
  },
  system: {
    language: 'tr',
    theme: 'auto',
    currency: 'TRY',
    dateFormat: 'dd.MM.yyyy',
  },
};

function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      notifications: { ...DEFAULT_PREFS.notifications, ...(parsed.notifications ?? {}) },
      system: { ...DEFAULT_PREFS.system, ...(parsed.system ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-toggle">
      <div>
        <strong>{label}</strong>
        <span>{hint}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={checked ? 'settings-switch on' : 'settings-switch'}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </label>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(() => loadPrefs());
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Password form state
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdStatus, setPwdStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [pwdMessage, setPwdMessage] = useState<string>('');

  useEffect(() => {
    if (!prefsSaved) return;
    const timeout = window.setTimeout(() => setPrefsSaved(false), 2400);
    return () => window.clearTimeout(timeout);
  }, [prefsSaved]);

  function updateNotifications(field: keyof NotificationPrefs, value: boolean) {
    setPrefs((current) => ({
      ...current,
      notifications: { ...current.notifications, [field]: value },
    }));
  }

  function updateSystem<K extends keyof SystemPrefs>(field: K, value: SystemPrefs[K]) {
    setPrefs((current) => ({
      ...current,
      system: { ...current.system, [field]: value },
    }));
  }

  function savePreferences() {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
    setPrefsSaved(true);
  }

  function resetPreferences() {
    setPrefs(DEFAULT_PREFS);
    localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    setPrefsSaved(true);
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pwdStatus === 'submitting') return;

    if (!pwd.current || !pwd.next || !pwd.confirm) {
      setPwdStatus('error');
      setPwdMessage('Tüm alanlar zorunludur.');
      return;
    }
    if (pwd.next.length < 8) {
      setPwdStatus('error');
      setPwdMessage('Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdStatus('error');
      setPwdMessage('Yeni şifre ve tekrarı eşleşmiyor.');
      return;
    }

    setPwdStatus('submitting');
    try {
      await changePassword(pwd.current, pwd.next, pwd.confirm);
      setPwd({ current: '', next: '', confirm: '' });
      setPwdStatus('success');
      setPwdMessage('Şifreniz başarıyla güncellendi.');
    } catch (err) {
      setPwdStatus('error');
      setPwdMessage(err instanceof Error ? err.message : 'Şifre değiştirilemedi.');
    }
  }

  return (
    <section className="settings-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">Atölye yönetimi</span>
          <h2>Ayarlar</h2>
          <p>Profil bilgileri, oturum güvenliği, bildirim tercihleri ve sistem ayarlarını yönetin.</p>
        </div>
      </header>

      <div className="settings-grid">
        {/* PROFILE */}
        <article className="surface-card settings-card">
          <header className="settings-card-header">
            <span className="eyebrow">Profil</span>
            <h3>Hesap Bilgileri</h3>
            <p>Oturum açan kullanıcının kimlik kartı.</p>
          </header>

          <div className="settings-profile-summary">
            <div className="settings-avatar">
              {user?.fullName
                ?.split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() ?? 'EG'}
            </div>
            <div>
              <strong>{user?.fullName ?? 'Atölye Kullanıcısı'}</strong>
              <span>{user?.roleLabel ?? '—'}</span>
              <small>{user?.username}</small>
            </div>
          </div>

          <div className="settings-profile-grid">
            <label className="field">
              <span>Ad Soyad</span>
              <input value={user?.fullName ?? ''} readOnly />
            </label>
            <label className="field">
              <span>Kullanıcı Adı</span>
              <input value={user?.username ?? ''} readOnly />
            </label>
            <label className="field">
              <span>Rol</span>
              <input value={user?.roleLabel ?? ''} readOnly />
            </label>
          </div>

          <p className="settings-card-note">
            Profil bilgisi değişiklikleri yetkililer tarafından güncellenir. Kullanıcı/rol
            yönetimi için <strong>Kullanıcılar</strong> sekmesini kullanın.
          </p>
        </article>

        {/* PASSWORD */}
        <article className="surface-card settings-card">
          <header className="settings-card-header">
            <span className="eyebrow">Güvenlik</span>
            <h3>Şifre Değiştir</h3>
            <p>Düzenli aralıklarla şifrenizi güncellemenizi tavsiye ederiz.</p>
          </header>

          <form className="settings-password-form" onSubmit={submitPassword}>
            <label className="field wide">
              <span>Mevcut Şifre</span>
              <input
                type="password"
                value={pwd.current}
                autoComplete="current-password"
                onChange={(event) => setPwd((p) => ({ ...p, current: event.target.value }))}
                disabled={pwdStatus === 'submitting'}
              />
            </label>
            <label className="field">
              <span>Yeni Şifre</span>
              <input
                type="password"
                value={pwd.next}
                autoComplete="new-password"
                onChange={(event) => setPwd((p) => ({ ...p, next: event.target.value }))}
                disabled={pwdStatus === 'submitting'}
              />
            </label>
            <label className="field">
              <span>Yeni Şifre Tekrar</span>
              <input
                type="password"
                value={pwd.confirm}
                autoComplete="new-password"
                onChange={(event) => setPwd((p) => ({ ...p, confirm: event.target.value }))}
                disabled={pwdStatus === 'submitting'}
              />
            </label>

            {pwdStatus === 'error' && (
              <p className="settings-inline-message error">{pwdMessage}</p>
            )}
            {pwdStatus === 'success' && (
              <p className="settings-inline-message success">{pwdMessage}</p>
            )}

            <div className="settings-form-actions">
              <span className="form-note">Yeni şifre en az 8 karakter olmalı.</span>
              <button
                className="primary-button"
                type="submit"
                disabled={pwdStatus === 'submitting'}
              >
                {pwdStatus === 'submitting' ? 'Güncelleniyor…' : 'Şifreyi Güncelle'}
              </button>
            </div>
          </form>
        </article>

        {/* NOTIFICATIONS */}
        <article className="surface-card settings-card">
          <header className="settings-card-header">
            <span className="eyebrow">İletişim</span>
            <h3>Bildirim Tercihleri</h3>
            <p>Hangi olaylarda haberdar olmak istediğinizi seçin.</p>
          </header>

          <div className="settings-toggles">
            <ToggleRow
              label="Sipariş Bildirimleri"
              hint="Yeni sipariş oluşturulduğunda e-posta al."
              checked={prefs.notifications.emailOrders}
              onChange={(value) => updateNotifications('emailOrders', value)}
            />
            <ToggleRow
              label="Randevu Bildirimleri"
              hint="Ziyaretçiden yeni randevu talebi geldiğinde e-posta al."
              checked={prefs.notifications.emailAppointments}
              onChange={(value) => updateNotifications('emailAppointments', value)}
            />
            <ToggleRow
              label="Kritik SMS Uyarıları"
              hint="Acil siparişler ve teslimat gecikmeleri için SMS gönder."
              checked={prefs.notifications.smsCritical}
              onChange={(value) => updateNotifications('smsCritical', value)}
            />
            <ToggleRow
              label="Haftalık Özet"
              hint="Pazartesi sabahları haftalık atölye özeti e-postası gönder."
              checked={prefs.notifications.weeklyDigest}
              onChange={(value) => updateNotifications('weeklyDigest', value)}
            />
          </div>
        </article>

        {/* SYSTEM */}
        <article className="surface-card settings-card">
          <header className="settings-card-header">
            <span className="eyebrow">Sistem</span>
            <h3>Görünüm ve Yerelleştirme</h3>
            <p>Panelin nasıl görüntüleneceğini ve veri formatlarını ayarlayın.</p>
          </header>

          <div className="settings-system-grid">
            <label className="field">
              <span>Dil</span>
              <select
                value={prefs.system.language}
                onChange={(event) => updateSystem('language', event.target.value as SystemPrefs['language'])}
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </label>

            <label className="field">
              <span>Tema</span>
              <select
                value={prefs.system.theme}
                onChange={(event) => updateSystem('theme', event.target.value as SystemPrefs['theme'])}
              >
                <option value="auto">Otomatik (sistem)</option>
                <option value="light">Açık</option>
                <option value="dark">Koyu</option>
              </select>
            </label>

            <label className="field">
              <span>Varsayılan Para Birimi</span>
              <select
                value={prefs.system.currency}
                onChange={(event) => updateSystem('currency', event.target.value as SystemPrefs['currency'])}
              >
                <option value="TRY">Türk Lirası (₺)</option>
                <option value="USD">Amerikan Doları ($)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </label>

            <label className="field">
              <span>Tarih Formatı</span>
              <select
                value={prefs.system.dateFormat}
                onChange={(event) => updateSystem('dateFormat', event.target.value as SystemPrefs['dateFormat'])}
              >
                <option value="dd.MM.yyyy">31.12.2026</option>
                <option value="yyyy-MM-dd">2026-12-31</option>
              </select>
            </label>
          </div>
        </article>
      </div>

      <footer className="settings-footer">
        {prefsSaved && (
          <span className="settings-saved-pill">Tercihler kaydedildi.</span>
        )}
        <button type="button" className="ghost-button" onClick={resetPreferences}>
          Varsayılana Sıfırla
        </button>
        <button type="button" className="primary-button" onClick={savePreferences}>
          Tercihleri Kaydet
        </button>
      </footer>
    </section>
  );
}
