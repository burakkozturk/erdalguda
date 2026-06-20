import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BlogPostResponse, getBlogPosts } from '../../api/blogApi';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(new Date(value));
}

export function BlogPage() {
  const [posts, setPosts] = useState<BlogPostResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getBlogPosts()
      .then((data) => {
        if (!cancelled) {
          setPosts(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Yazılar yüklenemedi.');
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="public-page">
      <section className="public-page-hero">
        <span className="kicker">Atölye Günlüğü</span>
        <h1>Üretim, kumaş ve terzilik zanaatı üzerine notlar.</h1>
        <p>
          Atölyenin mutfağından — kumaş seçiminden iç katmana, ütü ve presten yaka geometrisine
          kadar — gerçekten 'nasıl yapılır' sorusunun cevaplarını paylaşıyoruz.
        </p>
      </section>

      {error && <div className="state-message error">{error}</div>}

      {isLoading ? (
        <div className="state-message loading-state">Yazılar yükleniyor…</div>
      ) : posts.length === 0 ? (
        <div className="state-message">Henüz blog yazısı bulunmuyor.</div>
      ) : (
        <section className="blog-grid">
          {posts.map((post) => (
            <article className="blog-card" key={post.slug}>
              <span className="blog-card-category">{post.category}</span>
              <h2>
                <Link to={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>
              <p>{post.summary}</p>
              <div className="blog-card-footer">
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
              <Link className="blog-card-link" to={`/blog/${post.slug}`}>
                Yazıyı oku →
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
