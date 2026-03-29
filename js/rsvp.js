/* ══════════════════════════════════════════════
   BODA SOFÍA & JAVIER — RSVP Family Wizard
   5-step form: Group → Names → Bus → Menu → IBAN
   Registers N guests per family in Supabase
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    const SUPABASE_URL = 'https://lpatzgviideumccecfew.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYXR6Z3ZpaWRldW1jY2VjZmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTY2MDMsImV4cCI6MjA5MDA5MjYwM30.jWQrW6FqArq87w50YALA9CUxahyPzwHBQLd9kI7U4qY';

    const IBAN = 'ES13 0182 7066 2002 0065 3919';
    const TOTAL_STEPS = 5;

    // ── State ──
    let currentStep = 1;
    let adults = 1;
    let children = 0;
    let familyGroup = 'fam_' + Date.now();

    // Members array: [{nombre, apellidos, isChild, menu, alergias}]
    let members = [];

    // ── DOM refs ──
    const progressFill = document.getElementById('rsvp-progress-fill');
    const stepEls = document.querySelectorAll('.rsvp__step');
    const panels = {
        1: document.getElementById('rsvp-step-1'),
        2: document.getElementById('rsvp-step-2'),
        3: document.getElementById('rsvp-step-3'),
        4: document.getElementById('rsvp-step-4'),
        5: document.getElementById('rsvp-step-5'),
    };
    const confirmation = document.getElementById('rsvp-confirmation');

    const nameInput = document.getElementById('guest-name');
    const surnameInput = document.getElementById('guest-surname');
    const adultsCount = document.getElementById('adults-count');
    const childrenCount = document.getElementById('children-count');
    const groupSummary = document.getElementById('group-summary');

    // ── Step navigation ──
    function goToStep(step) {
        panels[currentStep].classList.remove('rsvp__panel--active');

        currentStep = step;
        panels[currentStep].classList.add('rsvp__panel--active');

        stepEls.forEach((s) => {
            const sn = parseInt(s.dataset.step);
            s.classList.remove('rsvp__step--active', 'rsvp__step--done');
            if (sn < currentStep) s.classList.add('rsvp__step--done');
            else if (sn === currentStep) s.classList.add('rsvp__step--active');
        });

        progressFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
        document.getElementById('rsvp').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function getSelectedRadio(name) {
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : null;
    }

    // ── Counter logic ──
    function updateCounters() {
        adultsCount.textContent = adults;
        childrenCount.textContent = children;

        document.getElementById('adults-minus').disabled = adults <= 1;
        document.getElementById('children-minus').disabled = children <= 0;
        document.getElementById('adults-plus').disabled = adults >= 10;
        document.getElementById('children-plus').disabled = children >= 10;

        const total = adults + children;
        if (total === 1) {
            groupSummary.textContent = '1 persona en total';
        } else {
            let parts = [];
            if (adults === 1) parts.push('1 adulto');
            else parts.push(adults + ' adultos');
            if (children === 1) parts.push('1 niño');
            else if (children > 1) parts.push(children + ' niños');
            groupSummary.textContent = parts.join(' y ') + ' — ' + total + ' en total';
        }
    }

    document.getElementById('adults-plus').addEventListener('click', () => { if (adults < 10) { adults++; updateCounters(); } });
    document.getElementById('adults-minus').addEventListener('click', () => { if (adults > 1) { adults--; updateCounters(); } });
    document.getElementById('children-plus').addEventListener('click', () => { if (children < 10) { children++; updateCounters(); } });
    document.getElementById('children-minus').addEventListener('click', () => { if (children > 0) { children--; updateCounters(); } });

    updateCounters();

    // ── Step 1 → Step 2 ──
    document.getElementById('rsvp-next-1').addEventListener('click', () => {
        const nombre = nameInput.value.trim();
        const apellidos = surnameInput.value.trim();
        if (!nombre || !apellidos) {
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

        // Build members array
        members = [];
        // First adult is the titular
        members.push({ nombre, apellidos, isChild: false, menu: null, alergias: null });
        // Remaining adults
        for (let i = 2; i <= adults; i++) {
            members.push({ nombre: '', apellidos: '', isChild: false, menu: null, alergias: null });
        }
        // Children
        for (let i = 1; i <= children; i++) {
            members.push({ nombre: '', apellidos: '', isChild: true, menu: null, alergias: null });
        }

        buildStep2();
        goToStep(2);
    });

    // ── Step 2: Name cards ──
    function buildStep2() {
        const container = document.getElementById('family-members');
        container.innerHTML = '';

        let adultIndex = 0;
        let childIndex = 0;

        members.forEach((m, i) => {
            const isFirst = i === 0;
            let label;
            if (m.isChild) {
                childIndex++;
                label = children === 1 ? 'Niño/a' : (childIndex === 1 ? 'Primer niño/a' : childIndex === 2 ? 'Segundo niño/a' : 'Niño/a ' + childIndex);
            } else {
                adultIndex++;
                if (isFirst) label = 'Tú';
                else label = adultIndex === 2 ? 'Segundo adulto' : 'Adulto ' + adultIndex;
            }

            const card = document.createElement('div');
            card.className = 'rsvp__member-card' + (m.isChild ? ' rsvp__member-card--child' : '');
            card.innerHTML = `
                <div class="rsvp__member-header">
                    <div class="rsvp__member-icon">${m.isChild ? '&#x1F9D2;'.replace(/&#x1F9D2;/, i + 1) : i + 1}</div>
                    <span class="rsvp__member-title">${label}</span>
                </div>
                <div class="rsvp__member-fields">
                    <div class="rsvp__form-group" style="margin-bottom:0">
                        <label class="rsvp__label">Nombre</label>
                        <input type="text" class="rsvp__input member-nombre" data-idx="${i}" placeholder="Nombre" value="${esc(m.nombre)}" ${isFirst ? 'readonly style="background:#f0ece6"' : ''}>
                    </div>
                    <div class="rsvp__form-group" style="margin-bottom:0">
                        <label class="rsvp__label">Apellidos</label>
                        <input type="text" class="rsvp__input member-apellidos" data-idx="${i}" placeholder="Apellidos" value="${esc(m.apellidos)}" ${isFirst ? 'readonly style="background:#f0ece6"' : ''}>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Step 2 → Step 3
    document.getElementById('rsvp-next-2').addEventListener('click', () => {
        // Read all member names
        let allValid = true;
        document.querySelectorAll('.member-nombre').forEach((input) => {
            const idx = parseInt(input.dataset.idx);
            members[idx].nombre = input.value.trim();
            if (!members[idx].nombre) {
                input.style.borderColor = '#e74c3c';
                input.addEventListener('input', function fix() { input.style.borderColor = ''; input.removeEventListener('input', fix); });
                allValid = false;
            }
        });
        document.querySelectorAll('.member-apellidos').forEach((input) => {
            const idx = parseInt(input.dataset.idx);
            members[idx].apellidos = input.value.trim();
            if (!members[idx].apellidos) {
                input.style.borderColor = '#e74c3c';
                input.addEventListener('input', function fix() { input.style.borderColor = ''; input.removeEventListener('input', fix); });
                allValid = false;
            }
        });

        if (!allValid) return;

        // Update transport hint
        const total = members.length;
        document.getElementById('transport-hint').textContent =
            total === 1 ? 'Selecciona cómo vas a llegar' : `Transporte para ${total} personas`;

        goToStep(3);
    });

    // ── Step 3: Transport ──
    document.querySelectorAll('input[name="transport"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            document.getElementById('rsvp-next-3').disabled = false;
        });
    });

    document.getElementById('rsvp-next-3').addEventListener('click', () => {
        if (!getSelectedRadio('transport')) return;
        buildStep4();
        goToStep(4);
    });

    // ── Step 4: Menu per person ──
    const MENU_SVG = {
        carne: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="32" cy="38" rx="24" ry="8"/><path d="M20 22 C20 16 28 10 32 10 C36 10 44 16 44 22 L44 34 C44 34 38 30 32 30 C26 30 20 34 20 34 Z"/><path d="M28 18 C30 16 34 16 36 18"/></svg>',
        pescado: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 32 C20 20 44 18 52 32 C44 46 20 44 12 32Z"/><circle cx="44" cy="30" r="2" fill="currentColor"/><path d="M6 24 L12 32 L6 40"/><path d="M24 28 C28 24 34 24 38 28"/><path d="M24 36 C28 40 34 40 38 36"/></svg>',
        vegetariano: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><path d="M32 52 L32 30"/><path d="M32 30 C24 24 20 14 28 8 C32 12 36 12 40 8 C48 14 44 24 32 30Z"/><path d="M26 44 C22 42 18 38 20 32"/><path d="M38 44 C42 42 46 38 44 32"/></svg>',
        vegano: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 48 C16 28 28 12 48 12 C48 32 36 48 16 48Z"/><path d="M16 48 C28 36 40 24 48 12"/><path d="M24 40 C28 32 34 28 38 22"/></svg>',
    };

    function buildStep4() {
        const container = document.getElementById('family-menus');
        container.innerHTML = '';

        members.forEach((m, i) => {
            const radioName = 'menu_' + i;
            const block = document.createElement('div');
            block.className = 'rsvp__menu-person';

            if (m.isChild) {
                // Children: fixed kids menu, only allergy field
                m.menu = 'infantil';
                block.innerHTML = `
                    <div class="rsvp__menu-person-name">
                        <div class="rsvp__member-icon" style="background:var(--olive)">${i + 1}</div>
                        ${esc(m.nombre)} ${esc(m.apellidos)} <span style="font-size:0.75rem;color:var(--olive);font-weight:400">(niño/a)</span>
                    </div>
                    <p style="font-size:0.9rem;color:var(--carbon-light);margin-bottom:10px;text-align:center;">Menu infantil incluido</p>
                    <div class="rsvp__form-group rsvp__form-group--allergy">
                        <label class="rsvp__label">¿Alguna alergia o intolerancia?</label>
                        <textarea class="rsvp__input rsvp__textarea allergy-input" data-idx="${i}" placeholder="Dejalo en blanco si no tiene" rows="2"></textarea>
                    </div>
                `;
            } else {
                // Adults: choose menu
                block.innerHTML = `
                    <div class="rsvp__menu-person-name">
                        <div class="rsvp__member-icon">${i + 1}</div>
                        ${esc(m.nombre)} ${esc(m.apellidos)}
                    </div>
                    <div class="rsvp__options rsvp__options--menu">
                        ${['carne', 'pescado', 'vegetariano', 'vegano'].map(opt => `
                            <label class="rsvp__option-circle">
                                <input type="radio" name="${radioName}" value="${opt}" class="rsvp__option-input menu-radio" data-idx="${i}">
                                <div class="rsvp__circle-visual">
                                    <div class="rsvp__circle-icon">${MENU_SVG[opt]}</div>
                                    <span class="rsvp__circle-label">${opt.charAt(0).toUpperCase() + opt.slice(1)}</span>
                                </div>
                                <div class="rsvp__option-check">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                    <div class="rsvp__form-group rsvp__form-group--allergy">
                        <label class="rsvp__label">¿Alguna alergia o intolerancia?</label>
                        <textarea class="rsvp__input rsvp__textarea allergy-input" data-idx="${i}" placeholder="Dejalo en blanco si no tiene" rows="2"></textarea>
                    </div>
                `;
            }

            container.appendChild(block);
        });

        // Listen for menu selections to enable next button
        container.querySelectorAll('.menu-radio').forEach(radio => {
            radio.addEventListener('change', checkAllMenusSelected);
        });
    }

    function checkAllMenusSelected() {
        // Only adults need to select menu; children already have 'infantil'
        const allSelected = members.every((m, i) => {
            if (m.isChild) return true;
            return document.querySelector(`input[name="menu_${i}"]:checked`);
        });
        document.getElementById('rsvp-next-4').disabled = !allSelected;
    }

    // Step 4 → Step 5 (save to Supabase)
    document.getElementById('rsvp-next-4').addEventListener('click', async () => {
        // Read menu + allergy data
        members.forEach((m, i) => {
            const checked = document.querySelector(`input[name="menu_${i}"]:checked`);
            m.menu = checked ? checked.value : null;
            const allergyEl = document.querySelector(`.allergy-input[data-idx="${i}"]`);
            m.alergias = allergyEl ? allergyEl.value.trim() || null : null;
        });

        // Check all menus selected
        if (members.some(m => !m.menu)) return;

        const btn = document.getElementById('rsvp-next-4');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        const transport = getSelectedRadio('transport');

        // Build records
        const records = members.map(m => ({
            nombre: m.nombre,
            apellidos: m.apellidos,
            autobus: transport,
            menu: m.menu,
            alergias: m.alergias,
            family_group: familyGroup,
            is_child: m.isChild,
        }));

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
                body: JSON.stringify(records),
            });
            saved = res.ok;
        } catch (err) {
            console.warn('Supabase save failed:', err);
        }

        if (!saved) {
            // Fallback: localStorage
            const guests = JSON.parse(localStorage.getItem('wedding_guests') || '[]');
            records.forEach(r => {
                r.id = Date.now() + Math.random();
                r.created_at = new Date().toISOString();
                guests.push(r);
            });
            localStorage.setItem('wedding_guests', JSON.stringify(guests));
        }

        btn.innerHTML = 'Siguiente <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        btn.disabled = false;
        goToStep(5);
    });

    // ── Step 5: IBAN ──
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
            const el = document.getElementById('iban-number');
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });
    });

    document.getElementById('rsvp-share').addEventListener('click', () => {
        const text = `Boda Sofía & Javier - 29 agosto 2026\n\nIBAN: ${IBAN}`;
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    });

    document.getElementById('rsvp-next-5').addEventListener('click', () => {
        showConfirmation();
    });

    // ── Back buttons ──
    document.getElementById('rsvp-back-2').addEventListener('click', () => goToStep(1));
    document.getElementById('rsvp-back-3').addEventListener('click', () => goToStep(2));
    document.getElementById('rsvp-back-4').addEventListener('click', () => goToStep(3));
    document.getElementById('rsvp-back-5').addEventListener('click', () => goToStep(4));

    // ── Confirmation + confetti ──
    function showConfirmation() {
        Object.values(panels).forEach((p) => p.classList.remove('rsvp__panel--active'));
        document.querySelector('.rsvp__progress').style.display = 'none';

        const titular = members[0];
        document.getElementById('confirm-name').textContent = titular.nombre;

        const total = members.length;
        if (total === 1) {
            document.getElementById('confirm-text').textContent =
                'Tu asistencia ha sido confirmada. ¡Nos lo vamos a pasar genial!';
        } else {
            document.getElementById('confirm-text').textContent =
                `Habéis confirmado ${total} personas. ¡Nos lo vamos a pasar genial todos juntos!`;
        }

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
        if (e.key === 'Enter') document.getElementById('rsvp-next-1').click();
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
})();
