/* ══════════════════════════════════════════════
   BUDGET BAR — Shared component across admin pages
   Shows previsto (virtual) & confirmado (matched) counts + cost
   ══════════════════════════════════════════════ */
(function () {
    'use strict';

    const COST_PER_GUEST = 125;

    function formatCurrency(n) {
        return n.toLocaleString('es-ES') + '\u2009\u20AC';
    }

    function createBar() {
        const bar = document.createElement('div');
        bar.id = 'budget-bar';
        bar.className = 'budget-bar';

        bar.innerHTML = `
            <div class="budget-bar__item budget-bar__item--previsto">
                <span class="budget-bar__label">Previstos:</span>
                <span class="budget-bar__num" id="bb-prev-count">0</span>
                <span class="budget-bar__label">invitados</span>
                <span class="budget-bar__sep">&middot;</span>
                <span class="budget-bar__cost" id="bb-prev-cost">0 &euro;</span>
            </div>
            <div class="budget-bar__item budget-bar__item--confirmado">
                <span class="budget-bar__label">Confirmados:</span>
                <span class="budget-bar__num" id="bb-conf-count">0</span>
                <span class="budget-bar__label">invitados</span>
                <span class="budget-bar__sep">&middot;</span>
                <span class="budget-bar__cost" id="bb-conf-cost">0 &euro;</span>
            </div>
        `;

        // Insert after nav
        const nav = document.querySelector('.admin-nav');
        if (nav && nav.nextSibling) {
            nav.parentNode.insertBefore(bar, nav.nextSibling);
        } else {
            document.body.prepend(bar);
        }
    }

    function update() {
        const virtuals = JSON.parse(localStorage.getItem('wedding_virtual_guests') || '[]');
        const matches = JSON.parse(localStorage.getItem('wedding_matches') || '{}');

        const totalVirtual = virtuals.length;
        const matchedCount = Object.keys(matches).length;

        const prevCount = document.getElementById('bb-prev-count');
        const prevCost = document.getElementById('bb-prev-cost');
        const confCount = document.getElementById('bb-conf-count');
        const confCost = document.getElementById('bb-conf-cost');

        if (prevCount) prevCount.textContent = totalVirtual;
        if (prevCost) prevCost.textContent = formatCurrency(totalVirtual * COST_PER_GUEST);
        if (confCount) confCount.textContent = matchedCount;
        if (confCost) confCost.textContent = formatCurrency(matchedCount * COST_PER_GUEST);
    }

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
        .budget-bar {
            position: sticky;
            top: 64px;
            z-index: 99;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 32px;
            padding: 10px 24px;
            background: #fff;
            border-bottom: 1px solid #f0ece6;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            flex-wrap: wrap;
        }
        .budget-bar__item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-family: 'Montserrat', sans-serif;
            font-size: 0.82rem;
        }
        .budget-bar__item--previsto {
            color: #888;
        }
        .budget-bar__item--confirmado {
            color: #2e7d32;
        }
        .budget-bar__label {
            font-weight: 400;
        }
        .budget-bar__num {
            font-family: 'Playfair Display', serif;
            font-weight: 700;
            font-size: 1.15rem;
        }
        .budget-bar__cost {
            font-weight: 700;
            font-size: 1rem;
        }
        .budget-bar__sep {
            opacity: 0.4;
            font-size: 1.2rem;
        }
        .budget-bar__item--confirmado .budget-bar__num,
        .budget-bar__item--confirmado .budget-bar__cost {
            color: #2e7d32;
        }
        .budget-bar__item--previsto .budget-bar__num,
        .budget-bar__item--previsto .budget-bar__cost {
            color: #666;
        }
        @media (max-width: 600px) {
            .budget-bar {
                flex-direction: column;
                gap: 4px;
                padding: 8px 16px;
            }
        }
    `;
    document.head.appendChild(style);

    createBar();
    update();

    // Re-update every 2 seconds to pick up changes from other scripts
    setInterval(update, 2000);

    // Also expose a global so other scripts can trigger immediate refresh
    window.updateBudgetBar = update;
})();
