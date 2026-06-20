import { FormEvent, useState } from 'react';
import { changePassword } from '../../api/authApi';

type FormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialFormState: FormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export function ChangePasswordPage() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
    setSuccess(null);
  }

  function validate() {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      return 'Tüm alanlar zorunludur.';
    }

    if (form.newPassword.length < 8) {
      return 'Yeni şifre en az 8 karakter olmalıdır.';
    }

    if (form.newPassword !== form.confirmPassword) {
      return 'Yeni şifre ve tekrarı eşleşmiyor.';
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(form.currentPassword, form.newPassword, form.confirmPassword);
      setForm(initialFormState);
      setSuccess('Şifreniz başarıyla değiştirildi.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Şifre değiştirilemedi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="password-page">
      <div className="page-header">
        <div className="section-heading">
          <span className="eyebrow">Oturum güvenliği</span>
          <h2>Şifre Değiştir</h2>
          <p>Panel giriş şifrenizi güncelleyin.</p>
        </div>
      </div>

      <form className="customer-form password-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="field wide">
            <span>Mevcut Şifre</span>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => updateField('currentPassword', event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="field">
            <span>Yeni Şifre</span>
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => updateField('newPassword', event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Yeni Şifre Tekrar</span>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              autoComplete="new-password"
            />
          </label>
        </div>

        {error && <div className="state-message error password-message">{error}</div>}
        {success && <div className="state-message success password-message">{success}</div>}

        <div className="form-actions">
          <span className="form-note">Yeni şifreniz en az 8 karakter olmalıdır.</span>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
          </button>
        </div>
      </form>
    </section>
  );
}
