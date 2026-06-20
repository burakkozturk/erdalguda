import { products } from '../../data/products';

export function ServicesPage() {
  return (
    <div className="public-page">
      <section className="public-page-hero">
        <span className="kicker">Hizmetler</span>
        <h1>Özel dikim gardırobun temel parçaları.</h1>
        <p>
          Her ürün grubu, müşterinin vücut yapısı, kullanım amacı ve kumaş beklentisi üzerinden
          ayrı ayrı ele alınır. Amaç; gösterişten uzak, dengeli ve uzun ömürlü bir şıklık kurmaktır.
        </p>
      </section>

      <section className="public-card-grid services-grid">
        {products.map((product) => (
          <article className="luxury-service-card product-service-card" key={product.id}>
            <img src={product.image} alt="" />
            <span>Ürün grubu</span>
            <h2>{product.title}</h2>
            <p>{product.longDescription}</p>
            <ul>
              {product.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
