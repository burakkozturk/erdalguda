import { FormEvent, useEffect, useState } from 'react';
import { getCustomers } from '../api/customerApi';
import type { Customer } from '../types/customer';
import type { ProductType, ProductionJobRequest, ProductionPriority } from '../types/production';
import { getPriorityLabel, getProductTypeLabel } from '../types/production';

type ProductionJobFormProps = {
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (data: ProductionJobRequest) => Promise<void> | void;
};

type FormState = {
  customerId: string;
  productType: ProductType | '';
  priority: ProductionPriority | '';
  expectedDeliveryDate: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const productTypes: ProductType[] = ['SHIRT', 'JACKET', 'TROUSERS', 'VEST', 'SUIT'];
const priorities: ProductionPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const initialForm: FormState = {
  customerId: '',
  productType: '',
  priority: 'NORMAL',
  expectedDeliveryDate: '',
  notes: '',
};

export function ProductionJobForm({ isSubmitting = false, onCancel, onSubmit }: ProductionJobFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [customerError, setCustomerError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      try {
        setCustomers(await getCustomers());
      } catch (error) {
        setCustomerError(error instanceof Error ? error.message : 'Müşteri listesi yüklenemedi.');
      }
    }

    void loadCustomers();
  }, []);

  function updateField(field: keyof FormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const nextErrors: FormErrors = {};

    if (!formData.customerId) {
      nextErrors.customerId = 'Müşteri seçimi zorunludur.';
    }

    if (!formData.productType) {
      nextErrors.productType = 'Ürün tipi zorunludur.';
    }

    if (!formData.priority) {
      nextErrors.priority = 'Öncelik zorunludur.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate() || !formData.productType || !formData.priority) {
      return;
    }

    await onSubmit({
      customerId: Number(formData.customerId),
      productType: formData.productType,
      priority: formData.priority,
      expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
      notes: formData.notes.trim() || undefined,
    });
  }

  return (
    <form className="production-job-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <div>
          <span className="eyebrow">Yeni üretim işi</span>
          <h3>Atölye iş akışına yeni kart ekleyin</h3>
          <p>İş otomatik olarak Ölçü / Satış aşamasında başlar ve ilgili sorumlu çalışana atanır.</p>
        </div>
        <button className="ghost-button small-button" type="button" onClick={onCancel} disabled={isSubmitting}>
          İptal
        </button>
      </div>

      {customerError && (
        <div className="state-message error" role="alert">
          {customerError}
        </div>
      )}

      <div className="form-grid">
        <label className="field">
          <span>Müşteri <em>Zorunlu</em></span>
          <select
            value={formData.customerId}
            onChange={(event) => updateField('customerId', event.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Müşteri seçin</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.firstName} {customer.lastName}
              </option>
            ))}
          </select>
          {errors.customerId && <small>{errors.customerId}</small>}
        </label>

        <label className="field">
          <span>Ürün Tipi <em>Zorunlu</em></span>
          <select
            value={formData.productType}
            onChange={(event) => updateField('productType', event.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Ürün tipi seçin</option>
            {productTypes.map((productType) => (
              <option key={productType} value={productType}>
                {getProductTypeLabel(productType)}
              </option>
            ))}
          </select>
          {errors.productType && <small>{errors.productType}</small>}
        </label>

        <label className="field">
          <span>Öncelik <em>Zorunlu</em></span>
          <select
            value={formData.priority}
            onChange={(event) => updateField('priority', event.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Öncelik seçin</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {getPriorityLabel(priority)}
              </option>
            ))}
          </select>
          {errors.priority && <small>{errors.priority}</small>}
        </label>

        <label className="field">
          <span>Beklenen Teslim Tarihi</span>
          <input
            type="date"
            value={formData.expectedDeliveryDate}
            onChange={(event) => updateField('expectedDeliveryDate', event.target.value)}
            disabled={isSubmitting}
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
        <span className="form-note">Kart oluşturulduktan sonra Kanban panosunda ilk aşamada görünür.</span>
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Oluşturuluyor...' : 'Üretim İşi Oluştur'}
        </button>
      </div>
    </form>
  );
}
