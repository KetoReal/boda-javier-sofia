/* ══════════════════════════════════════════════
   BODA SOFÍA & JAVIER — RSVP Wizard
   4-step form + IBAN share + Supabase + Confetti
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    const SUPABASE_URL = 'https://lpatzgviideumccecfew.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY2MDMsImV4cCI6MjA5MDA5MjYwM30.jWQrW6FqArq87w50YALA9CUxahyPzwHBQLd9kI7U4qY';

    const IBAN = 'ES13 0182 7066 2002 0065 3919';
    const TOTAL_STEPS = 4;

    // ── DOM refs ──
    const progressFill = document.getElementById('rsvp-progress-fill');
    const steps = document.querySelectorAll('.rsvp__step');
    const panels = {
        1: document.getElementById('rsvp-step-1'),
        2: document.getElementById('rsvp-step-2'),
        3: document.getElementById('rsvp-step-3'),
        4: document.getElementById('rsvp-step-4'),
    };
    const confirmation = document.getElementById('rsvp-confirmation');

    const nameInput = document.getElementById('guest-name');
    const surnameInput = document.getElementById('guest-surname');
    const allergyInput = document.getElementById('guest-allergy');

    const nextBtn1 = document.getElementById('rsvp-next-1');
    const nextBtn2 = document.getElementById('rsvp-next-2');
    const nextBtn3 = document.getElementById('rsvp-next-3');
    const backBtn2 = document.getElementById('rsvp-back-2');
    const backBtn3 = document.getElementById('rsvp-back-3');

    let currentStep = 1;

    // ── Step navigation ──
    function goToStep(step) {
        panels[currentStep].classList.remove('rsvp__panel--active');

        const prevStepEl = document.querySelector(`.rsvp__step[data-step="${currentStep}"]`);
        if (step > currentStep) {
            prevStepEl.classList.add('rsvp__step--done');
            prevStepEl.classList.remove('rsvp__step--active');
        }

        currentStep = step;
        panels[currentStep].classList.add('rsvp__panel--active');

        steps.forEach((s) => {
            const sn = parseInt(s.dataset.step);
            s.classList.remove('rsvp__step--active');
            if (sn < currentStep) {
                s.classList.add('rsvp__step--done');
            } else if (sn === currentStep) {
                s.classList.add('rsvp__step--active');
                s.classList.remove('rsvp__step--done');
            } else {
                s.classList.remove('rsvp__step--done');
            }
        });

        progressFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
        document.getElementById('rsvp').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── Validation ──
    function isStep1Valid() {
        return nameInput.value.trim() && surnameInput.value.trim();
    }

    function getSelectedRadio(name) {
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : null;
    }

    // Enable buttons on input
    [nameInput, surnameInput].forEach((input) => {
        input.addEventListener('input', () => { nextBtn1.disabled = false; });
    });

    document.querySelectorAll('input[name="transport"]').forEach((radio) => {
        radio.addEventListener('change', () => { nextBtn2.disabled = false; });
    });

    document.querySelectorAll('input[name="menu"]').forEach((radio) => {
        radio.addEventListener('change', () => { nextBtn3.disabled = false; });
    });

    // ── Navigation handlers ──
    nextBtn1.addEventListener('click', () => {
        if (!isStep1Valid()) {
            [nameInput, surnameInput].forEach((input) => {
                if (!input.value.trim()) {
                    input.style.borderColor = '#e74c3c';
                    input.addEventListener('input', function fix() {
                        input.style.borderColor = '';
                        input.removeEventListener('input', fix);
                    });
                }
            });
            return;
        }
        goToStep(2);
    });

    nextBtn2.addEventListener('click', () => {
        if (!getSelectedRadio('transport')) return;
        goToStep(3);
    });

    // Step 3 → submit data to Supabase, then go to step 4
    nextBtn3.addEventListener('click', async () => {
        const menu = getSelectedRadio('menu');
        if (!menu) return;

        nextBtn3.disabled = true;
        nextBtn3.textContent = 'Guardando...';

        const guestData = {
            nombre: nameInput.value.trim(),
            apellidos: surnameInput.value.trim(),
            autobus: getSelectedRadio('transport'),
            menu: menu,
            alergias: allergyInput.value.trim() || null,
        };

        // Save to Supabase
        let saved = false;
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/guests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify(guestData),
            });
            saved = res.ok;
        } catch (err) {
            console.warn('Supabase save failed:', err);
        }

        if (!saved) {
            const guests = JSON.parse(localStorage.getItem('wedding_guests') || '[]');
            guestData.id = Date.now();
            guestData.created_at = new Date().toISOString();
            guests.push(guestData);
            localStorage.setItem('wedding_guests', JSON.stringify(guests));
        }

        // Go to step 4 (IBAN / regalo)
        nextBtn3.textContent = 'Siguiente';
        nextBtn3.disabled = false;
        goToStep(4);
    });

    backBtn2.addEventListener('click', () => goToStep(1));
    backBtn3.addEventListener('click', () => goToStep(2));
    document.getElementById('rsvp-back-4').addEventListener('click', () => goToStep(3));

    // ── Step 4: IBAN actions ──

    // Copy IBAN
    document.getElementById('iban-copy').addEventListener('click', () => {
        const ibanClean = IBAN.replace(/\s/g, '');
        navigator.clipboard.writeText(ibanClean).then(() => {
            const btn = document.getElementById('iban-copy');
            const txt = document.getElementById('copy-text');
            btn.classList.add('copied');
            txt.textContent = 'Copiado';
            setTimeout(() => {
                btn.classList.remove('copied');
                txt.textContent = 'Copiar';
            }, 2000);
        }).catch(() => {
            // Fallback: select the text
            const el = document.getElementById('iban-number');
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });
    });

    // Share IBAN via WhatsApp
    document.getElementById('rsvp-share').addEventListener('click', () => {
        const text = `Boda Sofía & Javier - 29 agosto 2026\n\nIBAN: ${IBAN}`;
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    });

    // Continue to confirmation
    document.getElementById('rsvp-next-4').addEventListener('click', () => {
        showConfirmation(nameInput.value.trim());
    });

    // ── Confirmation + confetti ──
    function showConfirmation(name) {
        Object.values(panels).forEach((p) => p.classList.remove('rsvp__panel--active'));
        document.querySelector('.rsvp__progress').style.display = 'none';

        document.getElementById('confirm-name').textContent = name;
        confirmation.classList.add('rsvp__panel--active');
        fireRiceConfetti();
    }

    function fireRiceConfetti() {
        const canvas = document.getElementById('confetti-global-canvas');
        const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });

        myConfetti({
            particleCount: 150, spread: 100, origin: { y: 0.6 },
            colors: ['#C9A96E', '#E8D5B0', '#F5E6E0', '#FFFFFF', '#7D8C6C'],
            shapes: ['circle'], scalar: 0.8, gravity: 0.8, ticks: 200,
        });

        setTimeout(() => {
            myConfetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, colors: ['#C9A96E', '#E8D5B0', '#FFFFFF'], shapes: ['circle'], scalar: 0.6, gravity: 0.9 });
            myConfetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, colors: ['#C9A96E', '#E8D5B0', '#FFFFFF'], shapes: ['circle'], scalar: 0.6, gravity: 0.9 });
        }, 300);

        setTimeout(() => {
            myConfetti({ particleCount: 60, spread: 160, origin: { y: 0 }, colors: ['#C9A96E', '#E8D5B0', '#F5E6E0', '#FFFFFF'], shapes: ['circle'], scalar: 0.5, gravity: 0.4, drift: 0.5, ticks: 300 });
        }, 600);
    }

    // Enter to advance on step 1
    surnameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nextBtn1.click();
    });
})();
