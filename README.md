# 🛒 Shopify AJAX Cart Drawer with Upsell

> A fully-featured, production-ready AJAX Cart Drawer for Shopify — available in two versions: **Dawn Edition** (built specifically for Shopify's Dawn Theme) and **Generic Edition** (works on any Shopify theme).

![Shopify](https://img.shields.io/badge/Shopify-Compatible-96BF48?style=flat-square&logo=shopify&logoColor=white)
![Dawn](https://img.shields.io/badge/Dawn_Theme-v14+-orange?style=flat-square)
![Liquid](https://img.shields.io/badge/Liquid-Templating-0090D6?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla_ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Accessible](https://img.shields.io/badge/Accessibility-WCAG_2.1_AA-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## 🎯 Why This Exists

The default Shopify cart page is a conversion killer — it takes shoppers away from your store and breaks purchase momentum. This cart drawer keeps customers on the page, shows relevant upsells at the perfect moment, and makes the checkout experience feel fast and modern — **no app required.**

---

## ✨ Features

| Feature | Dawn | Generic |
|---|---|---|
| Slide-in drawer from right | ✅ | ✅ |
| AJAX add / update / remove | ✅ | ✅ |
| Quantity +/- controls with debounce | ✅ | ✅ |
| Remove with Undo toast | ✅ | ✅ |
| Free shipping progress bar | ✅ | ✅ |
| Upsell product recommendations | ✅ | ✅ |
| Cart note field | ✅ | ✅ |
| Empty cart state with CTA | ✅ | ✅ |
| Per-item loading states | ✅ | ✅ |
| Error handling (OOS, network, rate limits) | ✅ | ✅ |
| Focus trap + ARIA (a11y) | ✅ | ✅ |
| Keyboard navigation (Escape to close) | ✅ | ✅ |
| Touch / swipe to close | ✅ | ✅ |
| Dispatches `cart:refresh` event | ✅ | ✅ |
| Dawn CSS custom properties | ✅ | ❌ |
| Dawn Web Component pattern | ✅ | ❌ |
| Standalone CSS design tokens | ❌ | ✅ |
| Zero theme dependencies | ❌ | ✅ |

---

## 📁 File Structure

```
shopify-cart-drawer/
│
├── 📁 dawn/                          ← Dawn Theme Edition
│   ├── sections/
│   │   └── cart-drawer.liquid        ← Main drawer section
│   ├── snippets/
│   │   ├── cart-drawer-product.liquid ← Line item card
│   │   └── cart-upsell-product.liquid ← Upsell product card
│   └── assets/
│       ├── cart-drawer.js            ← Web Component AJAX logic
│       └── cart-drawer.css           ← Dawn-compatible styles
│
├── 📁 generic/                       ← Generic / Any Theme Edition
│   ├── sections/
│   │   └── cart-drawer-generic.liquid ← All-in-one drawer
│   └── assets/
│       ├── cart-drawer-generic.js    ← Standalone AJAX logic
│       └── cart-drawer-generic.css   ← Self-contained styles
│
└── README.md
```

---

## 🚀 Installation

### Dawn Edition

**Step 1 — Upload files to your Dawn theme:**

```
sections/  → cart-drawer.liquid
snippets/  → cart-drawer-product.liquid
snippets/  → cart-upsell-product.liquid
assets/    → cart-drawer.js
assets/    → cart-drawer.css
```

**Step 2 — Add the section to your theme:**

In `layout/theme.liquid`, add before the closing `</body>` tag:

```liquid
{% section 'cart-drawer' %}
```

**Step 3 — Add a trigger button to your header:**

In your header snippet, update your cart icon link to trigger the drawer:

```liquid
<button
  type="button"
  aria-controls="CartDrawer"
  aria-expanded="false"
  onclick="document.dispatchEvent(new CustomEvent('cart:open'))"
>
  <!-- your existing cart icon here -->
</button>
```

**Step 4 — Wrap product form with custom element:**

In your product form snippet, wrap the form tag:

```liquid
<cart-drawer-product-form>
  <form action="/cart/add" method="post">
    <!-- your existing product form -->
  </form>
</cart-drawer-product-form>
```

**Step 5 — Configure in Theme Editor:**

Go to **Online Store → Customize → Cart Drawer** section and configure:
- Free shipping threshold amount
- Upsell collection
- Cart note visibility
- Empty cart message and button

---

### Generic Edition

**Step 1 — Upload files:**

```
sections/ → cart-drawer-generic.liquid
assets/   → cart-drawer-generic.js
assets/   → cart-drawer-generic.css
```

**Step 2 — Add to theme layout:**

```liquid
{% section 'cart-drawer-generic' %}
```

**Step 3 — Trigger the drawer:**

```html
<!-- From any button or link -->
<button onclick="document.dispatchEvent(new CustomEvent('cart:open'))">
  Open Cart
</button>
```

**Step 4 — Intercept add-to-cart (AJAX):**

Fire the `cart:add` event after adding a product:

```javascript
// After successful /cart/add.js call:
document.dispatchEvent(new CustomEvent('cart:add'));
```

**Step 5 — Customize design tokens:**

In `cart-drawer-generic.css`, update the CSS variables at the top:

```css
:root {
  --cdg-bg:          #ffffff;    /* Drawer background */
  --cdg-text:        #1a1a1a;    /* Primary text */
  --cdg-accent:      #1a1a1a;    /* Button/CTA color */
  --cdg-accent-text: #ffffff;    /* Button text */
  --cdg-success:     #16a34a;    /* Free shipping bar */
  --cdg-radius:      0.6rem;     /* Border radius */
  --cdg-width:       42rem;      /* Drawer width */
}
```

---

## 🔌 JavaScript API

Both versions expose a global event-based API:

```javascript
// Open the cart drawer
document.dispatchEvent(new CustomEvent('cart:open'));

// Notify drawer that an item was added (triggers refresh + open)
document.dispatchEvent(new CustomEvent('cart:add'));

// Listen for cart updates (fires after every add/update/remove)
document.addEventListener('cart:refresh', (e) => {
  console.log('Cart updated:', e.detail.cartData);
  console.log('Item count:', e.detail.cartData.item_count);
  console.log('Total price:', e.detail.cartData.total_price);
});

// Listen for any cart change
document.addEventListener('cart:updated', (e) => {
  console.log('Cart changed:', e.detail.cart);
});
```

### Generic version — direct access:

```javascript
// Access the CartDrawerGeneric object directly
window.CartDrawerGeneric.open();
window.CartDrawerGeneric.close();
window.CartDrawerGeneric.showError('Out of stock!');
window.CartDrawerGeneric.refresh();
```

---

## ⚙️ Dawn Edition — Conventions Used

| Convention | Implementation |
|---|---|
| Web Components | `class CartDrawer extends HTMLElement` + `customElements.define()` |
| CSS Custom Properties | `--color-foreground`, `--color-base-background-1`, `--font-body-family` |
| Button Classes | `.button`, `.button--primary`, `.button--secondary`, `.button--tertiary` |
| Container | `.page-width` |
| Color Scheme | `color_scheme` setting picker — works with all Dawn palettes |
| Loading Spinner | `.loading-overlay__spinner` — matches Dawn's native pattern |
| Section Padding | `padding_top` / `padding_bottom` range settings with responsive scaling |
| Price Structure | `.price`, `.price--on-sale`, `.price__sale`, `.price__compare` |
| Accessibility | `.visually-hidden`, `aria-live`, `role="dialog"`, focus trap |
| Translation Keys | `t:sections.cart.*` i18n keys throughout schema |
| Cart Sync | Dispatches `cart:refresh` — syncs Dawn's header cart count bubble |

---

## 🎨 Upsell Configuration

The upsell section automatically:

- ✅ Filters out products already in the cart
- ✅ Only shows available products
- ✅ Shows a quick-add button for single-variant products
- ✅ Shows "Choose Options" link for multi-variant products
- ✅ Removes the upsell card after it's added
- ✅ Respects your configured product limit (1–4)

**To set up upsells:**
1. Create a Shopify collection (e.g., "Cart Upsells")
2. Add products you want to recommend
3. Select this collection in the Theme Editor under Cart Drawer → Upsell Collection

---

## ♿ Accessibility

- `role="dialog"` + `aria-modal="true"` on the drawer
- Focus trap — keyboard users can't tab outside an open drawer
- `Escape` key closes the drawer
- `aria-live` regions announce cart updates to screen readers
- `aria-label` on all interactive elements
- `prefers-reduced-motion` disables all animations
- Proper `aria-expanded` states on quantity buttons
- `role="progressbar"` on the shipping bar with `aria-valuenow`

---

## 🧪 Edge Cases Handled

| Scenario | Behavior |
|---|---|
| Item goes out of stock during session | Shows error toast, reverts quantity |
| Network request fails | Shows dismissible error message |
| Rate limit hit (429) | Shows "please wait" error message |
| Last item removed | Shows undo toast, then empty state |
| Undo triggered before timeout | Cancels removal, restores item |
| Multi-variant upsell product | Shows "Choose Options" link instead of Add |
| Cart has 0 items | Checkout button disabled, empty state shown |
| Product already in cart | Excluded from upsell recommendations |
| Inventory limit reached | Increase qty button disabled |

---

## 📋 Roadmap

- [ ] Sticky cart drawer (persists across navigation)
- [ ] Gift wrapping add-on option
- [ ] Discount code field in drawer
- [ ] Bundle upsell (buy X get Y)
- [ ] Recently viewed products in upsell slot
- [ ] Multi-currency support

---

## 👤 Author

**John Venedick Natividad**
Senior Shopify Developer & CRM Implementation Specialist
14+ years building eCommerce experiences for global brands

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat-square&logo=linkedin)](https://linkedin.com/in/jaynatividad)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-181717?style=flat-square&logo=github)](https://github.com/jaynatividad1489)
[![Email](https://img.shields.io/badge/Email-Contact-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:jaynatividad1489@gmail.com)

---

## 📄 License

MIT — free to use in personal and commercial Shopify projects.
If this saved you time, a ⭐ star on the repo is always appreciated!
