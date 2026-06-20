import { Link } from 'react-router-dom';
import heroImage from '../../assets/imgs/erdalguda-1.jpg';
import collageA from '../../assets/imgs/erdalguda-2.jpg';
import collageB from '../../assets/imgs/erdalguda-3.jpg';
import collageC from '../../assets/imgs/erdalguda-4.jpg';
import { products } from '../../data/products';

const process = [
  {
    title: 'Tanışma',
    description: 'İhtiyaç, kullanım alanı ve stil beklentisi sakin bir görüşmeyle netleştirilir.',
  },
  {
    title: 'Ölçü Alma',
    description: 'Duruş, omuz, göğüs, bel ve hareket alışkanlığı ölçü notlarıyla birlikte kaydedilir.',
  },
  {
    title: 'Prova',
    description: 'Kalıp dengesi, boylar ve rahatlık detayları müşterinin üzerinde incelenir.',
  },
  {
    title: 'Teslim',
    description: 'Son kontroller tamamlanır; parça kullanım önerileriyle birlikte teslim edilir.',
  },
];

export function HomePage() {
  return (
    <div className="public-page home-page">
      {/* Hero */}
      <section className="public-hero">
        <div className="hero-copy">
          <span className="kicker">Kişiye özel erkek terziliği</span>
          <h1>Ölçü, kalıp ve duruş üzerine kurulu zarif bir dikim deneyimi.</h1>
          <p>
            Gömlekten takım elbiseye, her parça müşterinin duruşuna, kullanım alışkanlığına ve
            kumaş tercihine göre hazırlanır. Erdal Güda atölyesinde amaç gösterişli olmak değil,
            doğru oturan ve uzun süre değerini koruyan bir gardırop oluşturmaktır.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" to="/appointment">
              Özel Randevu Al
            </Link>
            <Link className="button button-light" to="/services">
              Hizmetleri İncele
            </Link>
          </div>
        </div>

        <div className="hero-visual image-hero" aria-label="Özel dikim erkek terziliği görseli">
          <img src={heroImage} alt="Erdal Güda atölye" />
          <div className="visual-panel">
            <span>Atölye Notu</span>
            <strong>Kalıp, kumaş ve duruş aynı bütünün parçalarıdır.</strong>
          </div>
        </div>
      </section>

      {/* Products strip */}
      <section className="public-section">
        <div className="section-title-row">
          <span className="kicker">Hizmetler</span>
          <h2>Gardırobun temel parçaları için özel dikim yaklaşımı.</h2>
        </div>
        <div className="public-card-grid product-preview-grid">
          {products.map((product) => (
            <article className="service-preview-card product-preview-card" key={product.id}>
              <img src={product.image} alt={product.title} />
              <span>{product.title}</span>
              <p>{product.shortDescription}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Editorial visual story */}
      <section className="visual-story-section">
        <div className="visual-story-copy">
          <span className="kicker">Kumaş ve ölçü</span>
          <h2>Her çizgi, müşterinin üzerinde daha iyi durması için vardır.</h2>
          <p>
            Kumaş dokusu, ölçü çizgileri ve el işçiliği aynı karar zincirinin parçalarıdır.
            Terzilik süreci, yalnızca bedeni değil hareketi ve kullanım ritmini de dikkate alır.
          </p>
          <Link className="button button-light" to="/atelier">
            Atölyeyi Keşfet
          </Link>
        </div>
        <div className="visual-collage">
          <img src={collageA} alt="Atölye detay" />
        </div>
      </section>

      {/* Process */}
      <section className="public-section process-section">
        <div className="section-title-row">
          <span className="kicker">Süreç</span>
          <h2>Sakin, ölçülü ve titiz bir ilerleyiş.</h2>
        </div>
        <div className="process-steps">
          {process.map((step, index) => (
            <article className="process-card" key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Atelier statement */}
      <section className="atelier-statement">
        <span className="kicker">Atölye yaklaşımı</span>
        <h2>Kişiye özel terzilik, müşteriyi tanımadan başlamaz.</h2>
        <p>
          Duruş, meslek, seyahat alışkanlığı, tören ihtiyacı ve gündelik kullanım biçimi birlikte
          değerlendirilir. Böylece her parça yalnızca ölçüye değil, kişinin hayatına da uyum sağlar.
        </p>
      </section>

      {/* CTA */}
      <section className="public-cta">
        <div>
          <span className="kicker">Özel başlangıç</span>
          <h2>Yeni gömlek, ceket veya takım elbise sürecinizi birlikte planlayalım.</h2>
        </div>
        <Link className="button button-gold" to="/appointment">
          Randevu Al
        </Link>
      </section>
    </div>
  );
}
