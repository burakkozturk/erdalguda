type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="page-panel">
      <div className="section-heading">
        <span className="eyebrow">Modül</span>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </section>
  );
}
