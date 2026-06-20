import atelierImg1 from '../../assets/imgs/erdalguda-11.jpg';
import atelierImg2 from '../../assets/imgs/erdalguda-12.jpg';
import atelierImg3 from '../../assets/imgs/erdalguda-13.jpg';
import atelierHeroImg from '../../assets/imgs/erdalguda-14.jpg';

const sections = [
  {
    title: 'Atölye Yaklaşımı',
    body: 'Her çalışma, müşterinin ihtiyaçlarını anlamakla başlar. Amaç hızlı üretim değil, doğru kararların sakin biçimde alınmasıdır.',
  },
  {
    title: 'Zanaatkârlık',
    body: 'Omuz hattı, göğüs rahatlığı, bel oturuşu ve parça dengesi; ustalığın görünmeden hissettirdiği detaylardır.',
  },
  {
    title: 'Ölçü Hassasiyeti',
    body: 'Ölçüler yalnızca sayılardan ibaret değildir. Duruş, hareket ve kullanım alışkanlığı profilin ayrılmaz parçasıdır.',
  },
  {
    title: 'Kumaş ve Kalıp Felsefesi',
    body: 'Kumaş seçimi; mevsim, ağırlık, döküm ve kullanım amacına göre yapılır. Kalıp ise bu kumaşı kişinin üzerinde doğal göstermek için kurulur.',
  },
  {
    title: 'Kişiye Özel Deneyim',
    body: 'Randevular özel, odaklı ve ölçülüdür. Her müşteri kendi gardırop ihtiyacına göre yönlendirilen kişisel bir süreç yaşar.',
  },
];

export function AtelierPage() {
  return (
    <div className="public-page">
      <section className="public-page-hero atelier-page-hero">
        <span className="kicker">Atölye</span>
        <h1>Modern erkekler için özel bir terzilik evi.</h1>
        <p>
          Erdal Güda atölyesi, zarafeti ölçü, duruş ve kumaş bilgisiyle kurar. Her karar sade,
          kişisel ve uzun ömürlü bir görünüm için alınır.
        </p>
      </section>

      {/* Real photo strip */}
      <section className="atelier-visual-strip">
        <img src={atelierImg1} alt="Atölye detay" />
        <img src={atelierImg2} alt="Kumaş ve malzeme" />
        <img src={atelierImg3} alt="Prova ve ölçü çalışması" />
      </section>

      {/* Editorial: image card + copy stack */}
      <section className="atelier-editorial">
        <div
          className="atelier-image-card atelier-image-card--photo"
          style={{ backgroundImage: `url(${atelierHeroImg})` }}
        >
          <div className="atelier-image-card-overlay">
            <span>Atölye notları</span>
            <strong>Ölçü, kumaş, hareket ve bitiş aynı bütünün parçalarıdır.</strong>
          </div>
        </div>

        <div className="atelier-copy-stack">
          {sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
