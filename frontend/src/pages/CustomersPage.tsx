import { useEffect, useState } from 'react';
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from '../api/customerApi';
import { CustomerForm } from '../components/CustomerForm';
import { useAuth } from '../context/AuthContext';
import type { Customer, CustomerRequest } from '../types/customer';

type FormMode = 'create' | 'edit' | null;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
  }).format(new Date(value));
}

function fullName(customer: Customer) {
  return `${customer.firstName} ${customer.lastName}`;
}

function formatGender(gender: Customer['gender']) {
  return gender === 'MALE' ? 'Erkek' : gender;
}

function formatProfile(customer: Customer) {
  const height = customer.heightCm ? `${customer.heightCm} cm` : '-';
  const weight = customer.weightKg ? `${customer.weightKg} kg` : '-';
  return `${height} / ${weight}`;
}

export function CustomersPage() {
  const { hasRole } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManageCustomers = hasRole('ADMIN', 'SALES');

  async function loadCustomers() {
    setIsLoading(true);
    setError(null);

    try {
      setCustomers(await getCustomers());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Müşteriler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  function openCreateForm() {
    setSelectedCustomer(null);
    setFormMode('create');
    setError(null);
  }

  function openEditForm(customer: Customer) {
    setSelectedCustomer(customer);
    setFormMode('edit');
    setError(null);
  }

  function closeForm() {
    setSelectedCustomer(null);
    setFormMode(null);
  }

  async function handleSubmit(data: CustomerRequest) {
    setIsSubmitting(true);
    setError(null);

    try {
      if (formMode === 'edit' && selectedCustomer) {
        await updateCustomer(selectedCustomer.id, data);
      } else {
        await createCustomer(data);
      }

      closeForm();
      await loadCustomers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Müşteri kaydedilemedi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm('Müşteriyi silmek istediğinize emin misiniz?');

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      await deleteCustomer(customer.id);
      await loadCustomers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Müşteri silinemedi.');
    }
  }

  return (
    <section className="customers-page">
      <div className="page-header">
        <div className="section-heading">
          <span className="eyebrow">Özel müşteri kayıtları</span>
          <h2>Müşteri Defteri</h2>
          <p>Erkek özel dikim müşterilerini ve profil bilgilerini yönetin.</p>
        </div>
        {canManageCustomers && (
          <button className="primary-button" type="button" onClick={openCreateForm}>
            Müşteri Ekle
          </button>
        )}
      </div>

      {formMode && canManageCustomers && (
        <CustomerForm
          customer={selectedCustomer}
          isSubmitting={isSubmitting}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      )}

      <div className="surface-card table-card">
        <div className="section-header table-card-header">
          <div>
            <span className="eyebrow">Müşteri listesi</span>
            <h2>Kayıtlı Profiller</h2>
          </div>
          <span className="count-badge">{customers.length} profil</span>
        </div>

        {error && (
          <div className="state-message error" role="alert">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="state-message loading-state">Müşteriler yükleniyor...</div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <span className="empty-mark">EG</span>
            <h3>Müşteri bulunamadı</h3>
            <p>Özel dikim müşteri defterini oluşturmaya başlamak için ilk profili ekleyin.</p>
            {canManageCustomers && (
              <button className="primary-button" type="button" onClick={openCreateForm}>
                Müşteri Ekle
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Telefon</th>
                  <th>E-posta</th>
                  <th>Profil</th>
                  <th>Cinsiyet</th>
                  <th>Kayıt Tarihi</th>
                  {canManageCustomers && <th>İşlemler</th>}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{fullName(customer)}</strong>
                    </td>
                    <td>{customer.phone}</td>
                    <td>{customer.email || '-'}</td>
                    <td>
                      <span className="profile-pill">{formatProfile(customer)}</span>
                    </td>
                    <td>
                      <span className="status-pill">{formatGender(customer.gender)}</span>
                    </td>
                    <td>{formatDateTime(customer.createdAt)}</td>
                    {canManageCustomers && (
                      <td>
                        <div className="row-actions">
                          <button className="ghost-button small-button" type="button" onClick={() => openEditForm(customer)}>
                            Düzenle
                          </button>
                          <button className="danger-button small-button" type="button" onClick={() => handleDelete(customer)}>
                            Sil
                          </button>
                        </div>
                      </td>
                    )}
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
