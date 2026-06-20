import { FormEvent, useEffect, useState } from 'react';
import type { Customer, CustomerRequest } from '../types/customer';

type CustomerFormProps = {
  customer?: Customer | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (data: CustomerRequest) => Promise<void> | void;
};

type FormErrors = Partial<Record<keyof CustomerRequest, string>>;

const emptyForm: CustomerRequest = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  heightCm: '',
  weightKg: '',
  address: '',
  notes: '',
};

function toFormData(customer?: Customer | null): CustomerRequest {
  if (!customer) {
    return emptyForm;
  }

  return {
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    heightCm: customer.heightCm?.toString() ?? '',
    weightKg: customer.weightKg?.toString() ?? '',
    address: customer.address ?? '',
    notes: customer.notes ?? '',
  };
}

function cleanPayload(data: CustomerRequest): CustomerRequest {
  const heightCm = data.heightCm?.toString().trim();
  const weightKg = data.weightKg?.toString().trim();

  return {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    phone: data.phone.trim(),
    email: data.email?.trim() || undefined,
    heightCm: heightCm ? Number(heightCm) : undefined,
    weightKg: weightKg ? Number(weightKg) : undefined,
    address: data.address?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
  };
}

export function CustomerForm({ customer, isSubmitting = false, onCancel, onSubmit }: CustomerFormProps) {
  const [formData, setFormData] = useState<CustomerRequest>(() => toFormData(customer));
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    setFormData(toFormData(customer));
    setErrors({});
  }, [customer]);

  const isEditing = Boolean(customer);

  function updateField(field: keyof CustomerRequest, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(data: CustomerRequest) {
    const nextErrors: FormErrors = {};

    if (!data.firstName.trim()) {
      nextErrors.firstName = 'Ad zorunludur.';
    }

    if (!data.lastName.trim()) {
      nextErrors.lastName = 'Soyad zorunludur.';
    }

    if (!data.phone.trim()) {
      nextErrors.phone = 'Telefon zorunludur.';
    }

    const heightCm = data.heightCm?.toString().trim();
    if (heightCm && (!Number.isFinite(Number(heightCm)) || Number(heightCm) <= 0)) {
      nextErrors.heightCm = 'Boy pozitif bir değer olmalıdır.';
    }

    const weightKg = data.weightKg?.toString().trim();
    if (weightKg && (!Number.isFinite(Number(weightKg)) || Number(weightKg) <= 0)) {
      nextErrors.weightKg = 'Kilo pozitif bir değer olmalıdır.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate(formData)) {
      return;
    }

    await onSubmit(cleanPayload(formData));
  }

  return (
    <form className="customer-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <div>
          <span className="eyebrow">{isEditing ? 'Profili düzenle' : 'Yeni profil'}</span>
          <h3>{isEditing ? `${customer?.firstName} ${customer?.lastName}` : 'Müşteri Ekle'}</h3>
          <p>Ölçü, prova ve özel sipariş süreçlerinde kullanılacak müşteri bilgilerini düzenleyin.</p>
        </div>
        <button className="ghost-button small-button" type="button" onClick={onCancel} disabled={isSubmitting}>
          İptal
        </button>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Ad <em>Zorunlu</em></span>
          <input
            value={formData.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
            disabled={isSubmitting}
          />
          {errors.firstName && <small>{errors.firstName}</small>}
        </label>

        <label className="field">
          <span>Soyad <em>Zorunlu</em></span>
          <input
            value={formData.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
            disabled={isSubmitting}
          />
          {errors.lastName && <small>{errors.lastName}</small>}
        </label>

        <label className="field">
          <span>Telefon <em>Zorunlu</em></span>
          <input
            value={formData.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            disabled={isSubmitting}
          />
          {errors.phone && <small>{errors.phone}</small>}
        </label>

        <label className="field">
          <span>E-posta</span>
          <input
            type="email"
            value={formData.email}
            onChange={(event) => updateField('email', event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="field">
          <span>Boy (cm)</span>
          <input
            type="number"
            min="1"
            step="0.1"
            inputMode="decimal"
            value={formData.heightCm}
            onChange={(event) => updateField('heightCm', event.target.value)}
            disabled={isSubmitting}
          />
          {errors.heightCm && <small>{errors.heightCm}</small>}
        </label>

        <label className="field">
          <span>Kilo (kg)</span>
          <input
            type="number"
            min="1"
            step="0.1"
            inputMode="decimal"
            value={formData.weightKg}
            onChange={(event) => updateField('weightKg', event.target.value)}
            disabled={isSubmitting}
          />
          {errors.weightKg && <small>{errors.weightKg}</small>}
        </label>

        <label className="field wide">
          <span>Adres</span>
          <textarea
            value={formData.address}
            onChange={(event) => updateField('address', event.target.value)}
            disabled={isSubmitting}
            rows={3}
          />
        </label>

        <label className="field wide">
          <span>Notlar</span>
          <textarea
            value={formData.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            disabled={isSubmitting}
            rows={3}
          />
        </label>
      </div>

      <div className="form-actions">
        <span className="form-note">Cinsiyet, atölye müşteri profili için Erkek olarak yönetilir.</span>
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Kaydediliyor...' : isEditing ? 'Kaydet' : 'Müşteri Oluştur'}
        </button>
      </div>
    </form>
  );
}
