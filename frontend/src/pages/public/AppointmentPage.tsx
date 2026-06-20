import { FormEvent, useState } from 'react';
import appointmentImg from '../../assets/imgs/erdalguda-15.jpg';
import { products } from '../../data/products';
import { createAppointment } from '../../api/appointmentApi';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function AppointmentPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [requestedService, setRequestedService] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;

    if (!fullName.trim() || !phone.trim()) {
      setStatus('error');
      setErrorMessage('Ad Soyad ve Telefon alanları zorunludur.');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      await createAppointment({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        requestedService: requestedService || undefined,
        preferredDate: preferredDate || undefined,
        notes: notes.trim() || undefined,
      });
      setStatus('success');
      setFullName('');
      setPhone('');
      setEmail('');
      setRequestedService('');
      setPreferredDate('');
      setNotes('');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Randevu talebi iletilemedi.');
    }
  }

  return (
    <div className="public-page">
      <section className="public-page-hero appointment-hero">
        <span className="kicker">Randevu</span>
        <h1>Özel atölye randevusu talep edin.</h1>
        <p>
          İhtiyacınızı ve tercih ettiğiniz tarihi paylaşın. Talebiniz, atölye operasyon paneline
          doğrudan iletilir ve en kısa sürede tarafınıza dönüş yapılır.
        </p>
      </section>

      <section className="appointment-layout">
        <form className="appointment-form public-form" onSubmit={handleSubmit}>
          <label>
            <span>Ad Soyad</span>
            <input
              placeholder="Adınız ve soyadınız"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={status === 'submitting'}
              required
            />
          </label>
          <label>
            <span>Telefon</span>
            <input
              placeholder="Telefon numarası"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={status === 'submitting'}
              required
            />
          </label>
          <label>
            <span>E-posta</span>
            <input
              type="email"
              placeholder="E-posta adresi"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={status === 'submitting'}
            />
          </label>
          <label>
            <span>Talep Edilen Hizmet</span>
            <select
              value={requestedService}
              onChange={(event) => setRequestedService(event.target.value)}
              disabled={status === 'submitting'}
            >
              <option value="">Hizmet seçin</option>
              {products.map((product) => (
                <option key={product.id} value={product.title}>{product.title}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Tercih Edilen Tarih</span>
            <input
              type="date"
              value={preferredDate}
              onChange={(event) => setPreferredDate(event.target.value)}
              disabled={status === 'submitting'}
            />
          </label>
          <label className="wide">
            <span>Notlar</span>
            <textarea
              rows={5}
              placeholder="Kullanım amacı, tercih edilen zaman veya özel notlar"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={status === 'submitting'}
            />
          </label>

          {status === 'error' && (
            <p className="appointment-form-message error" role="alert">{errorMessage}</p>
          )}
          {status === 'success' && (
            <p className="appointment-form-message success">
              Randevu talebiniz iletildi. En kısa sürede sizinle iletişime geçeceğiz.
            </p>
          )}

          <button className="button button-dark" type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Gönderiliyor…' : 'Talep Gönder'}
          </button>
        </form>

        <div className="appointment-image-panel">
          <img src={appointmentImg} alt="Erdal Güda atölye" />
          <div className="appointment-image-caption">
            <span className="kicker">Atölye ortamı</span>
            <p>Sakin, odaklı ve kişisel bir ölçü deneyimi için atölyemize bekliyoruz.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
