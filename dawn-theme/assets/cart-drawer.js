/**
 * Cart Drawer — Dawn Edition
 * Compatible with: Shopify Dawn Theme (v14+)
 * Author: John Venedick Natividad
 * GitHub: https://github.com/jaynatividad1489
 *
 * Features:
 * - Web Component pattern (customElements) — matches Dawn's architecture
 * - AJAX cart add / update / remove via Shopify Cart API
 * - Debounced quantity input changes
 * - Per-item loading states
 * - Free shipping progress bar updates
 * - Upsell quick-add
 * - Undo remove toast
 * - Focus trap (a11y)
 * - Dispatches cart:refresh for Dawn header count sync
 * - Error handling: out of stock, network failures, rate limits
 * - Keyboard: Escape closes drawer
 */

/* ─────────────────────────────────────────────
   CartDrawer Web Component
───────────────────────────────────────────── */
class CartDrawer extends HTMLElement {
  constructor() {
    super();

    // DOM refs
    this.panel        = this.querySelector('#CartDrawerPanel');
    this.overlay      = this.querySelector('#CartDrawerOverlay');
    this.closeBtn     = this.querySelector('#CartDrawerClose');
    this.body         = this.querySelector('#CartDrawerBody');
    this.footer       = this.querySelector('#CartDrawerFooter');
    this.subtotal     = this.querySelector('#CartSubtotal');
    this.countBadge   = this.querySelector('#CartDrawerCount');
    this.errorEl      = this.querySelector('#CartDrawerError');
    this.errorMsg     = this.querySelector('#CartDrawerErrorMsg');
    this.shippingFill = this.querySelector('#CartShippingFill');
    this.shippingBar  = this.querySelector('#CartShippingBar');
    this.shippingMsg  = this.querySelector('.cart-drawer__shipping-msg');
    this.checkoutBtn  = this.querySelector('#CartCheckoutBtn');

    // Config
    this.threshold    = parseInt(this.dataset.freeShippingThreshold) || 0;
    this.currency     = this.dataset.currency || 'USD';

    // State
    this.isOpen       = false;
    this.pendingRemove = null; // for undo functionality
    this.debounceTimer = null;

    this.init();
  }

  /* ── Init ── */
  init() {
    // Close triggers
    this.closeBtn?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', () => this.close());

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // Error close
    this.errorEl?.querySelector('.cart-drawer__error-close')
      ?.addEventListener('click', () => this.hideError());

    // Quantity buttons & remove (delegated)
    this.addEventListener('click', this.handleItemClick.bind(this));

    // Quantity input (debounced)
    this.addEventListener('change', this.handleQtyInputChange.bind(this));

    // Upsell add buttons (delegated)
    this.addEventListener('click', this.handleUpsellClick.bind(this));

    // Listen for external open trigger (e.g. from header cart icon)
    document.addEventListener('cart:open', () => this.open());

    // Listen for add-to-cart from product forms on the page
    document.addEventListener('cart:add', (e) => {
      this.refreshCart();
      this.open();
    });

    // Sync header cart count on load
    this.syncHeaderCount();
  }

  /* ── Open / Close ── */
  open() {
    this.isOpen = true;
    this.setAttribute('aria-hidden', 'false');
    this.panel.removeAttribute('inert');
    document.body.classList.add('cart-drawer-open');
    this.overlay.removeAttribute('aria-hidden');

    // Animate in
    requestAnimationFrame(() => {
      this.panel.classList.add('is-open');
      this.overlay.classList.add('is-visible');
    });

    // Focus trap
    this.trapFocus();

    // Announce to screen readers
    this.panel.setAttribute('tabindex', '-1');
    this.panel.focus({ preventScroll: true });
  }

  close() {
    this.isOpen = false;
    this.panel.classList.remove('is-open');
    this.overlay.classList.remove('is-visible');
    document.body.classList.remove('cart-drawer-open');

    // Re-enable page scroll
    this.panel.setAttribute('inert', '');
    this.overlay.setAttribute('aria-hidden', 'true');

    // Return focus to opener
    const opener = document.querySelector('[aria-controls="CartDrawer"]');
    opener?.focus();

    this.releaseFocus();
  }

  /* ── Focus Trap ── */
  trapFocus() {
    const focusable = this.panel.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    this._trapHandler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    this.panel.addEventListener('keydown', this._trapHandler);
  }

  releaseFocus() {
    this.panel.removeEventListener('keydown', this._trapHandler);
  }

  /* ── Item Interactions ── */
  handleItemClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const key    = btn.dataset.key;
    const index  = btn.dataset.index;

    if (action === 'increase') {
      const input = this.querySelector(`#CartQtyInput-${index}`);
      const newQty = parseInt(input.value) + 1;
      this.updateItem(key, newQty, index);
    }

    if (action === 'decrease') {
      const input = this.querySelector(`#CartQtyInput-${index}`);
      const newQty = parseInt(input.value) - 1;
      if (newQty <= 0) {
        this.removeItemWithUndo(key, index);
      } else {
        this.updateItem(key, newQty, index);
      }
    }

    if (action === 'remove') {
      this.removeItemWithUndo(key, index);
    }
  }

  handleQtyInputChange(e) {
    const input = e.target.closest('.cart-drawer__qty-input');
    if (!input) return;

    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const key   = input.dataset.key;
      const index = input.dataset.index;
      const qty   = parseInt(input.value);

      if (isNaN(qty) || qty < 0) {
        input.value = 1;
        return;
      }

      if (qty === 0) {
        this.removeItemWithUndo(key, index);
      } else {
        this.updateItem(key, qty, index);
      }
    }, 400);
  }

  /* ── Upsell Quick Add ── */
  handleUpsellClick(e) {
    const btn = e.target.closest('.cart-upsell__add[data-variant-id]');
    if (!btn) return;

    const variantId = btn.dataset.variantId;
    const productId = btn.dataset.productId;
    if (!variantId) return;

    this.setUpsellLoading(btn, true);

    this.cartAdd(variantId, 1)
      .then(() => {
        this.refreshCart();
        // Remove upsell card after add
        const card = this.querySelector(`#UpsellCard-${productId}`);
        card?.classList.add('cart-upsell__card--added');
        setTimeout(() => card?.remove(), 400);
      })
      .catch((err) => {
        this.showError(err.message || 'Could not add item. Please try again.');
        this.setUpsellLoading(btn, false);
      });
  }

  setUpsellLoading(btn, loading) {
    const label   = btn.querySelector('.cart-upsell__add-label');
    const spinner = btn.querySelector('.loading-overlay__spinner');
    btn.disabled  = loading;
    label?.classList.toggle('hidden', loading);
    spinner?.classList.toggle('hidden', !loading);
  }

  /* ── AJAX: Update Item Quantity ── */
  async updateItem(key, quantity, index) {
    this.setItemLoading(index, true);
    this.hideError();

    try {
      const data = await this.cartChange(key, quantity);
      this.renderCartUpdate(data);
    } catch (err) {
      this.showError(err.message || 'Could not update item. Please try again.');
    } finally {
      this.setItemLoading(index, false);
    }
  }

  /* ── AJAX: Remove Item with Undo ── */
  removeItemWithUndo(key, index) {
    const item = this.querySelector(`#CartItem-${index}`);
    if (!item) return;

    // Snapshot item HTML for undo
    const snapshot = item.outerHTML;
    this.pendingRemove = { key, index, snapshot };

    // Animate out
    item.classList.add('cart-drawer__item--removing');

    setTimeout(async () => {
      // If undo wasn't triggered, proceed with removal
      if (this.pendingRemove && this.pendingRemove.key === key) {
        this.setItemLoading(index, true);
        this.hideError();

        try {
          const data = await this.cartChange(key, 0);
          this.renderCartUpdate(data);
          this.pendingRemove = null;
        } catch (err) {
          this.showError(err.message || 'Could not remove item. Please try again.');
          // Restore item on error
          item.classList.remove('cart-drawer__item--removing');
        } finally {
          this.setItemLoading(index, false);
        }
      }
    }, 3500); // Wait for undo window

    // Show undo toast
    this.showUndoToast(key, index, item, snapshot);
  }

  showUndoToast(key, index, item, snapshot) {
    // Remove existing toast
    this.querySelector('.cart-drawer__undo-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = 'cart-drawer__undo-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <span>Item removed</span>
      <button class="cart-drawer__undo-btn link" type="button">Undo</button>
    `;

    this.panel.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    // Undo handler
    toast.querySelector('.cart-drawer__undo-btn').addEventListener('click', () => {
      this.pendingRemove = null;
      item.classList.remove('cart-drawer__item--removing');
      toast.remove();
    });

    // Auto-remove toast
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  /* ── AJAX: Full Cart Refresh ── */
  async refreshCart() {
    try {
      const response = await fetch(`${window.Shopify.routes.root}cart.js`);
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      this.renderCartUpdate(data);
    } catch (err) {
      console.error('Cart refresh failed:', err);
    }
  }

  /* ── AJAX: Cart Add ── */
  cartAdd(variantId, quantity = 1) {
    return fetch(`${window.Shopify.routes.root}cart/add.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: variantId, quantity })
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw new Error(json.description || json.message || 'Could not add to cart.');
      return json;
    });
  }

  /* ── AJAX: Cart Change ── */
  cartChange(key, quantity) {
    return fetch(`${window.Shopify.routes.root}cart/change.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id: key, quantity })
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) {
        // Handle specific Shopify errors
        if (res.status === 422) throw new Error(json.description || 'Item is no longer available.');
        if (res.status === 429) throw new Error('Too many requests. Please wait a moment.');
        throw new Error(json.description || json.message || 'Could not update cart.');
      }
      return json;
    });
  }

  /* ── Render Cart Update ── */
  renderCartUpdate(cartData) {
    const count    = cartData.item_count;
    const total    = cartData.total_price;
    const items    = cartData.items;

    // Update count badge
    if (this.countBadge) {
      this.countBadge.textContent = `(${count})`;
    }

    // Update subtotal
    if (this.subtotal) {
      this.subtotal.textContent = this.formatMoney(total, this.currency);
    }

    // Update checkout button state
    if (this.checkoutBtn) {
      this.checkoutBtn.disabled = count === 0;
    }

    // Update shipping bar
    this.updateShippingBar(total);

    // Sync header cart count across Dawn theme
    this.syncHeaderCount(count);

    // Dispatch Dawn-compatible events
    document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cartData } }));
    document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: { cart: cartData } }));

    // Show empty state if needed
    if (count === 0) {
      this.renderEmptyState();
    }
  }

  renderEmptyState() {
    const itemsList = this.querySelector('#CartDrawerItems');
    const footer    = this.querySelector('#CartDrawerFooter');
    const upsell    = this.querySelector('#CartUpsell');
    const note      = this.querySelector('.cart-drawer__note');

    itemsList?.closest('form')?.remove();
    upsell?.remove();
    note?.remove();
    footer?.remove();

    const empty = document.createElement('div');
    empty.className = 'cart-drawer__empty';
    empty.id = 'CartDrawerEmpty';
    empty.innerHTML = `
      <div class="cart-drawer__empty-inner">
        <h3 class="cart-drawer__empty-heading">Your cart is empty</h3>
        <a href="/collections/all" class="button button--primary">Continue Shopping</a>
      </div>
    `;
    this.body?.appendChild(empty);
  }

  /* ── Shipping Bar Update ── */
  updateShippingBar(totalCents) {
    if (!this.shippingFill || this.threshold === 0) return;

    const progress = Math.min(Math.round((totalCents / this.threshold) * 100), 100);
    this.shippingFill.style.width = `${progress}%`;
    this.shippingFill.closest('[role="progressbar"]')?.setAttribute('aria-valuenow', progress);

    if (this.shippingMsg) {
      if (totalCents >= this.threshold) {
        this.shippingMsg.textContent = '🎉 You\'ve unlocked free shipping!';
        this.shippingMsg.classList.add('cart-drawer__shipping-msg--success');
      } else {
        const remaining = this.formatMoney(this.threshold - totalCents, this.currency);
        this.shippingMsg.textContent = `Spend ${remaining} more for free shipping`;
        this.shippingMsg.classList.remove('cart-drawer__shipping-msg--success');
      }
    }
  }

  /* ── Sync Header Cart Count ── */
  syncHeaderCount(count) {
    // Dawn's header cart bubble uses .cart-count-bubble
    const bubbles = document.querySelectorAll('.cart-count-bubble');
    bubbles.forEach((bubble) => {
      if (count !== undefined) {
        bubble.setAttribute('aria-hidden', count === 0 ? 'true' : 'false');
        const countEl = bubble.querySelector('[aria-hidden]');
        if (countEl) countEl.textContent = count;
      }
    });
  }

  /* ── Per-Item Loading State ── */
  setItemLoading(index, loading) {
    const loadingEl = this.querySelector(`#CartItemLoading-${index}`);
    const item      = this.querySelector(`#CartItem-${index}`);
    if (!loadingEl || !item) return;

    if (loading) {
      loadingEl.removeAttribute('hidden');
      loadingEl.removeAttribute('aria-hidden');
      item.classList.add('cart-drawer__item--loading');
    } else {
      loadingEl.setAttribute('hidden', '');
      loadingEl.setAttribute('aria-hidden', 'true');
      item.classList.remove('cart-drawer__item--loading');
    }
  }

  /* ── Error Handling ── */
  showError(message) {
    if (!this.errorEl || !this.errorMsg) return;
    this.errorMsg.textContent = message;
    this.errorEl.removeAttribute('hidden');

    // Auto-hide after 5s
    clearTimeout(this._errorTimer);
    this._errorTimer = setTimeout(() => this.hideError(), 5000);
  }

  hideError() {
    this.errorEl?.setAttribute('hidden', '');
  }

  /* ── Money Formatter ── */
  formatMoney(cents, currency) {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 2
      }).format(cents / 100);
    } catch {
      return `${(cents / 100).toFixed(2)}`;
    }
  }
}

customElements.define('cart-drawer', CartDrawer);

/* ─────────────────────────────────────────────
   Global: Intercept Product Form Submissions
   Converts standard add-to-cart forms to AJAX
───────────────────────────────────────────── */
class CartDrawerProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form[action*="/cart/add"]');
    this.form?.addEventListener('submit', this.handleSubmit.bind(this));
  }

  async handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData(this.form);
    const variantId = formData.get('id');
    const quantity  = formData.get('quantity') || 1;

    const submitBtn = this.form.querySelector('[type="submit"]');
    const spinner   = this.form.querySelector('.loading-overlay__spinner');
    const label     = submitBtn?.querySelector('span:not(.loading-overlay__spinner)');

    // Show loading
    if (submitBtn) submitBtn.disabled = true;
    spinner?.classList.remove('hidden');
    label?.classList.add('hidden');

    try {
      await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ id: variantId, quantity: parseInt(quantity) })
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.description || json.message || 'Could not add to cart.');
        return json;
      });

      // Dispatch event for CartDrawer to pick up
      document.dispatchEvent(new CustomEvent('cart:add', { bubbles: true }));

    } catch (err) {
      // Show error in the drawer or fallback alert
      const drawer = document.querySelector('cart-drawer');
      if (drawer) {
        drawer.showError(err.message);
        drawer.open();
      } else {
        alert(err.message);
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      spinner?.classList.add('hidden');
      label?.classList.remove('hidden');
    }
  }
}

customElements.define('cart-drawer-product-form', CartDrawerProductForm);
