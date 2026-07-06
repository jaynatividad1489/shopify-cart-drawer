/**
 * Cart Drawer — Generic / Standalone Version
 * Works on ANY Shopify theme (no Dawn dependency)
 * Author: John Venedick Natividad
 * GitHub: https://github.com/jaynatividad1489
 */

(function () {
  'use strict';

  const CDG = {
    drawer:        document.getElementById('CartDrawerGeneric'),
    panel:         document.getElementById('CdgPanel'),
    overlay:       document.getElementById('CdgOverlay'),
    closeBtn:      document.getElementById('CdgClose'),
    body:          document.getElementById('CdgBody'),
    footer:        document.getElementById('CdgFooter'),
    subtotal:      document.getElementById('CdgSubtotal'),
    count:         document.getElementById('CdgCount'),
    shippingFill:  document.getElementById('CdgShippingFill'),
    shippingMsg:   document.getElementById('CdgShippingMsg'),
    errorEl:       document.getElementById('CdgError'),
    errorText:     document.getElementById('CdgErrorText'),
    checkoutBtn:   document.getElementById('CdgCheckout'),
    isOpen:        false,
    debounceTimer: null,
    errorTimer:    null,
    pendingRemove: null,
    threshold:     0,
    currency:      'USD',

    init() {
      if (!this.drawer) return;

      this.threshold = parseInt(this.drawer.dataset.freeShipping) || 0;
      this.currency  = this.drawer.dataset.currency || 'USD';

      // Close triggers
      this.closeBtn?.addEventListener('click', () => this.close());
      this.overlay?.addEventListener('click', () => this.close());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) this.close();
      });

      // Error close
      this.errorEl?.querySelector('.cdg__error-close')
        ?.addEventListener('click', () => this.hideError());

      // Delegated events on drawer
      this.drawer.addEventListener('click', this.onClick.bind(this));
      this.drawer.addEventListener('change', this.onQtyChange.bind(this));

      // Swipe to close (touch)
      this.initSwipe();

      // External triggers
      document.addEventListener('cart:open', () => this.open());
      document.addEventListener('cart:add',  () => { this.refresh(); this.open(); });
    },

    open() {
      this.isOpen = true;
      this.drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('cdg-open');
      requestAnimationFrame(() => {
        this.panel.classList.add('is-open');
        this.overlay.classList.add('is-visible');
      });
      this.trapFocus();
      this.panel.focus({ preventScroll: true });
    },

    close() {
      this.isOpen = false;
      this.panel.classList.remove('is-open');
      this.overlay.classList.remove('is-visible');
      document.body.classList.remove('cdg-open');
      this.drawer.setAttribute('aria-hidden', 'true');
      this.releaseFocus();
      document.querySelector('[data-cart-open], [aria-controls="CartDrawerGeneric"]')?.focus();
    },

    trapFocus() {
      const focusable = this.panel.querySelectorAll(
        'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      this._trap = (e) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      };
      this.panel.addEventListener('keydown', this._trap);
    },

    releaseFocus() {
      this.panel.removeEventListener('keydown', this._trap);
    },

    initSwipe() {
      let startX = 0;
      this.panel.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
      this.panel.addEventListener('touchend',   (e) => {
        if (e.changedTouches[0].clientX - startX > 80) this.close();
      }, { passive: true });
    },

    /* ── Click Delegation ── */
    onClick(e) {
      // Qty buttons
      const qtyBtn = e.target.closest('[data-action]');
      if (qtyBtn) {
        const { action, index, key } = qtyBtn.dataset;
        const input = document.getElementById(`CdgQtyInput-${index}`);
        if (!input) return;
        const qty = parseInt(input.value);

        if (action === 'increase') this.updateItem(key, qty + 1, index);
        if (action === 'decrease') {
          if (qty - 1 <= 0) this.removeWithUndo(key, index);
          else this.updateItem(key, qty - 1, index);
        }
        if (action === 'remove') this.removeWithUndo(key, index);
      }

      // Upsell add
      const upsellBtn = e.target.closest('.cdg__upsell-add[data-variant-id]');
      if (upsellBtn) {
        const { variantId, productId } = upsellBtn.dataset;
        this.upsellAdd(upsellBtn, variantId, productId);
      }
    },

    onQtyChange(e) {
      const input = e.target.closest('.cdg__qty-input');
      if (!input) return;
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        const qty = parseInt(input.value);
        if (isNaN(qty) || qty < 0) { input.value = 1; return; }
        if (qty === 0) this.removeWithUndo(input.dataset.key, input.dataset.index);
        else this.updateItem(input.dataset.key, qty, input.dataset.index);
      }, 400);
    },

    /* ── AJAX ── */
    async updateItem(key, qty, index) {
      this.setItemLoading(index, true);
      this.hideError();
      try {
        const data = await this.apiChange(key, qty);
        this.renderUpdate(data);
        const input = document.getElementById(`CdgQtyInput-${index}`);
        if (input) input.value = qty;
      } catch (err) {
        this.showError(err.message);
      } finally {
        this.setItemLoading(index, false);
      }
    },

    removeWithUndo(key, index) {
      const item = document.getElementById(`CdgItem-${index}`);
      if (!item) return;
      const snapshot = item.outerHTML;
      this.pendingRemove = { key, index, snapshot };
      item.classList.add('cdg__item--out');
      this.showUndoToast(key, index, item);

      setTimeout(async () => {
        if (this.pendingRemove?.key === key) {
          this.setItemLoading(index, true);
          try {
            const data = await this.apiChange(key, 0);
            this.renderUpdate(data);
            this.pendingRemove = null;
          } catch (err) {
            this.showError(err.message);
            item.classList.remove('cdg__item--out');
          } finally {
            this.setItemLoading(index, false);
          }
        }
      }, 3500);
    },

    showUndoToast(key, index, item) {
      this.panel.querySelector('.cdg__undo-toast')?.remove();
      const toast = document.createElement('div');
      toast.className = 'cdg__undo-toast';
      toast.setAttribute('role', 'status');
      toast.innerHTML = `<span>Item removed</span><button class="cdg__undo-btn" type="button">Undo</button>`;
      this.panel.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('is-visible'));

      toast.querySelector('.cdg__undo-btn').addEventListener('click', () => {
        this.pendingRemove = null;
        item.classList.remove('cdg__item--out');
        toast.remove();
      });

      setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 300);
      }, 3200);
    },

    async upsellAdd(btn, variantId, productId) {
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await this.apiAdd(variantId, 1);
        await this.refresh();
        const card = document.getElementById(`CdgUpsell-${productId}`);
        if (card) { card.style.opacity = '0'; setTimeout(() => card.remove(), 300); }
      } catch (err) {
        this.showError(err.message);
        btn.disabled = false;
        btn.textContent = 'Add';
      }
    },

    async refresh() {
      try {
        const res  = await fetch(`${window.Shopify.routes.root}cart.js`);
        const data = await res.json();
        this.renderUpdate(data);
      } catch (e) { console.warn('Cart refresh failed', e); }
    },

    apiAdd(variantId, qty) {
      return fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: qty })
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.description || j.message || 'Could not add item.');
        return j;
      });
    },

    apiChange(key, qty) {
      return fetch(`${window.Shopify.routes.root}cart/change.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) {
          if (r.status === 422) throw new Error(j.description || 'Item unavailable.');
          if (r.status === 429) throw new Error('Too many requests. Please wait.');
          throw new Error(j.description || j.message || 'Could not update cart.');
        }
        return j;
      });
    },

    /* ── Render ── */
    renderUpdate(data) {
      const count = data.item_count;
      const total = data.total_price;

      if (this.count)    this.count.textContent = `(${count})`;
      if (this.subtotal) this.subtotal.textContent = this.money(total);
      if (this.checkoutBtn) this.checkoutBtn.disabled = count === 0;

      this.updateShippingBar(total);
      this.syncHeaderCount(count);

      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cartData: data } }));
      document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: { cart: data } }));

      if (count === 0) this.renderEmpty();
    },

    renderEmpty() {
      document.getElementById('CdgItems')?.closest('form')?.remove();
      document.getElementById('CdgUpsell')?.remove();
      document.querySelector('.cdg__note')?.remove();
      document.getElementById('CdgFooter')?.remove();
      const empty = document.createElement('div');
      empty.className = 'cdg__empty';
      empty.innerHTML = `<h3 class="cdg__empty-title">Your cart is empty</h3>
        <a href="/collections/all" class="cdg__btn cdg__btn--primary">Continue Shopping</a>`;
      this.body?.appendChild(empty);
    },

    updateShippingBar(totalCents) {
      if (!this.shippingFill || !this.threshold) return;
      const pct = Math.min(Math.round((totalCents / this.threshold) * 100), 100);
      this.shippingFill.style.width = `${pct}%`;
      this.shippingFill.closest('[role=progressbar]')?.setAttribute('aria-valuenow', pct);
      if (this.shippingMsg) {
        if (totalCents >= this.threshold) {
          this.shippingMsg.textContent = "🎉 You've unlocked free shipping!";
          this.shippingMsg.classList.add('cdg__shipping-msg--done');
        } else {
          this.shippingMsg.textContent = `Spend ${this.money(this.threshold - totalCents)} more for free shipping`;
          this.shippingMsg.classList.remove('cdg__shipping-msg--done');
        }
      }
    },

    syncHeaderCount(count) {
      document.querySelectorAll('.cart-count-bubble, [data-cart-count]').forEach((el) => {
        el.textContent = count;
        el.setAttribute('aria-hidden', count === 0 ? 'true' : 'false');
      });
    },

    setItemLoading(index, loading) {
      const el   = document.getElementById(`CdgItemLoading-${index}`);
      const item = document.getElementById(`CdgItem-${index}`);
      if (!el || !item) return;
      loading ? el.removeAttribute('hidden') : el.setAttribute('hidden', '');
      item.classList.toggle('cdg__item--loading', loading);
    },

    showError(msg) {
      if (!this.errorEl || !this.errorText) return;
      this.errorText.textContent = msg;
      this.errorEl.removeAttribute('hidden');
      clearTimeout(this.errorTimer);
      this.errorTimer = setTimeout(() => this.hideError(), 5000);
    },

    hideError() {
      this.errorEl?.setAttribute('hidden', '');
    },

    money(cents) {
      try {
        return new Intl.NumberFormat(document.documentElement.lang || 'en', {
          style: 'currency', currency: this.currency
        }).format(cents / 100);
      } catch { return `${(cents / 100).toFixed(2)}`; }
    }
  };

  document.addEventListener('DOMContentLoaded', () => CDG.init());

  // Expose globally so other scripts can open the drawer
  window.CartDrawerGeneric = CDG;
})();
