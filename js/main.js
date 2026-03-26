/* ══════════════════════════════════════════════
   BODA SOFÍA & JAVIER — Main JS
   Scroll animations, countdown, smooth scroll
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    // ── Hero loaded effect (slow zoom) ──
    window.addEventListener('load', () => {
        document.getElementById('hero').classList.add('loaded');
    });

    // ── Scroll animations (IntersectionObserver) ──
    const animElements = document.querySelectorAll('[data-animate]');

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry, i) => {
                    if (entry.isIntersecting) {
                        // Stagger children slightly
                        setTimeout(() => {
                            entry.target.classList.add('is-visible');
                        }, i * 100);
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
        );
        animElements.forEach((el) => observer.observe(el));
    } else {
        // Fallback: show all
        animElements.forEach((el) => el.classList.add('is-visible'));
    }

    // ── Countdown timer ──
    const weddingDate = new Date('2026-08-29T17:30:00+02:00'); // Ceremony time CEST

    function updateCountdown() {
        const now = new Date();
        const diff = weddingDate - now;

        if (diff <= 0) {
            document.getElementById('cd-days').textContent = '0';
            document.getElementById('cd-hours').textContent = '00';
            document.getElementById('cd-minutes').textContent = '00';
            document.getElementById('cd-seconds').textContent = '00';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        document.getElementById('cd-days').textContent = days;
        document.getElementById('cd-hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('cd-minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('cd-seconds').textContent = String(seconds).padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);

    // ── Smooth scroll for anchor links ──
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (e) => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ── Parallax: hero bg + floating rings ──
    let ticking = false;
    const heroBg = document.querySelector('.hero__bg');
    const rings = document.querySelectorAll('.parallax-ring');

    // Fade rings in after a short delay
    setTimeout(() => {
        rings.forEach((r) => r.classList.add('is-ready'));
    }, 600);

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const scrollY = window.scrollY;

                // Hero background parallax
                if (scrollY < window.innerHeight && heroBg) {
                    heroBg.style.transform = `scale(${1.1 - scrollY * 0.0001}) translateY(${scrollY * 0.3}px)`;
                }

                // Floating rings parallax
                rings.forEach((ring) => {
                    const speed = parseFloat(ring.dataset.speed) || 0.05;
                    const rotate = parseFloat(ring.dataset.rotate) || 0;
                    const y = scrollY * speed;
                    const r = scrollY * rotate;
                    ring.style.transform = `translateY(${y}px) rotate(${r}deg)`;
                });

                ticking = false;
            });
            ticking = true;
        }
    });

    // ── Periodic bounce on CTA button ──
    const ctaBtn = document.querySelector('.btn--glow');
    if (ctaBtn) {
        setInterval(() => {
            // Only bounce if button is in viewport
            const rect = ctaBtn.getBoundingClientRect();
            if (rect.top > 0 && rect.bottom < window.innerHeight) {
                ctaBtn.classList.add('bounce');
                ctaBtn.addEventListener('animationend', () => {
                    ctaBtn.classList.remove('bounce');
                }, { once: true });
            }
        }, 4000);
    }
})();
