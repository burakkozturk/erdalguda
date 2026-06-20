type ComingSoonProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function ComingSoon({ eyebrow, title, description }: ComingSoonProps) {
  return (
    <section className="coming-soon-page">
      <div className="coming-soon-card">
        <span className="coming-soon-mark" aria-hidden>EG</span>
        <span className="coming-soon-eyebrow">{eyebrow}</span>
        <h2 className="coming-soon-title">Çok yakında hizmetinizde</h2>
        <p className="coming-soon-subtitle">{title}</p>
        <p className="coming-soon-body">{description}</p>
        <div className="coming-soon-progress" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
