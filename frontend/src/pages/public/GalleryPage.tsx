import { useState, useCallback, useEffect } from 'react';
import { galleryImages } from '../../data/galleryImages';

export function GalleryPage() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const openLightbox = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const goNext = useCallback(() => {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex + 1) % galleryImages.length);
  }, [activeIndex]);

  const goPrev = useCallback(() => {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex - 1 + galleryImages.length) % galleryImages.length);
  }, [activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (activeIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, closeLightbox, goNext, goPrev]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (activeIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeIndex]);

  return (
    <div className="public-page gallery-page">
      <section className="public-page-hero gallery-page-hero">
        <span className="kicker">Galeri</span>
        <h1>Galeri</h1>
        <p>
          Erdal Güda atölyesinden özel dikim, kumaş, prova ve detay odaklı görsel seçkiler.
        </p>
      </section>

      <section className="gallery-grid" aria-label="Galeri görselleri">
        {galleryImages.map((src, index) => (
          <button
            key={src}
            className="gallery-thumb"
            onClick={() => openLightbox(index)}
            aria-label={`Görseli büyüt: ${index + 1} / ${galleryImages.length}`}
            type="button"
          >
            <img
              src={src}
              alt={`Erdal Güda atölye görseli ${index + 1}`}
              loading="lazy"
            />
            <span className="gallery-thumb-overlay" aria-hidden="true" />
          </button>
        ))}
      </section>

      {activeIndex !== null && (
        <div
          className="gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Görsel önizleme"
          onClick={closeLightbox}
        >
          <div
            className="gallery-lightbox-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={galleryImages[activeIndex]}
              alt={`Erdal Güda atölye görseli ${activeIndex + 1}`}
              className="gallery-lightbox-img"
            />

            <div className="gallery-lightbox-controls">
              <button
                className="gallery-lightbox-nav gallery-lightbox-prev"
                onClick={goPrev}
                type="button"
                aria-label="Önceki görsel"
              >
                &#8592;
              </button>

              <span className="gallery-lightbox-counter">
                {activeIndex + 1} / {galleryImages.length}
              </span>

              <button
                className="gallery-lightbox-nav gallery-lightbox-next"
                onClick={goNext}
                type="button"
                aria-label="Sonraki görsel"
              >
                &#8594;
              </button>
            </div>

            <button
              className="gallery-lightbox-close"
              onClick={closeLightbox}
              type="button"
              aria-label="Kapat"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
