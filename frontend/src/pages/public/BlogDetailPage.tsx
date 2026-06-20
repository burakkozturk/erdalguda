import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BlogPostResponse, getBlogPost } from '../../api/blogApi';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(new Date(value));
}

export function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getBlogPost(slug)
      .then((data) => {
        if (!cancelled) {
          setPost(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Yazı yüklenemedi.');
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="public-page">
        <div className="state-message loading-state">Yazı yükleniyor…</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="public-page">
        <div className="state-message error">{error ?? 'Yazı bulunamadı.'}</div>
        <Link className="blog-back-link" to="/blog">← Tüm yazılara dön</Link>
      </div>
    );
  }

  const paragraphs = post.body.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="public-page blog-detail-page">
      <Link className="blog-back-link" to="/blog">← Tüm yazılar</Link>

      <header className="blog-detail-hero">
        <span className="kicker">{post.category}</span>
        <h1>{post.title}</h1>
        <p className="blog-detail-summary">{post.summary}</p>
        <div className="blog-detail-meta">
          <span>{post.author ?? 'Atölye'}</span>
          <span>·</span>
          <span>{formatDate(post.publishedAt)}</span>
          {post.readTime && (
            <>
              <span>·</span>
              <span>{post.readTime} okuma</span>
            </>
          )}
        </div>
      </header>

      <article className="blog-detail-body">
        {paragraphs.map((paragraph, idx) => (
          <p key={idx}>{paragraph}</p>
        ))}
      </article>
    </div>
  );
}
