/* ============================================================
   BETON — SHARED JAVASCRIPT
   Kyoto, 2026
   ============================================================ */

// ===================== PRODUCTS DATABASE =====================
const PRODUCTS = {
  strata: {
    id: 'strata',
    name: 'STRATA',
    nameJP: 'STRATA',
    tag: '001 — CONCRETE ASHTRAY',
    tagJP: '001 — コンクリート灰皿',
    price: 26000,
    maxQty: 10,
    img: '/images/strata-45.png',
    images: [
      '/images/strata-45.png',
      '/images/strata-top.png',
      '/images/strata-side.png'
    ],
    desc: 'Topographic concrete ashtray. Hand-poured in Kyoto. Each piece unique — no two are identical. Functions as ashtray, incense holder, or key tray.',
    descJP: '地形図をモチーフにしたコンクリート灰皿。京都で手作り。一点一点異なる表情を持つ。灰皿、お香立て、キートレイとして使えます。',
    specs: {
      'MATERIAL':   { en: 'Handcast concrete', jp: 'コンクリート' },
      'DIMENSIONS': { en: '∅130mm × 33mm',    jp: '∅130mm × 33mm' },
      'WEIGHT':     { en: 'approx. 480g',       jp: '約480g' },
      'ORIGIN':     { en: 'Kyoto, Japan',       jp: '京都' },
      'FINISH':     { en: 'Matte, hand-sanded', jp: 'マット、手研磨' }
    }
  }
};

// ===================== CART =====================
class BetonCart {
  constructor() {
    this.items = this.load();
    this.qty = 1;
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem('beton_cart') || '[]');
    } catch { return []; }
  }

  save() {
    try {
      localStorage.setItem('beton_cart', JSON.stringify(this.items));
    } catch (e) {
      console.error('Cart save failed:', e);
    }
  }

  add(productId, qty = 1) {
    const product = PRODUCTS[productId];
    if (!product) return;
    const existing = this.items.find(i => i.id === productId);
    const maxQty = product.maxQty || 10;
    if (existing) {
      existing.qty = Math.min(maxQty, existing.qty + qty);
    } else {
      this.items.push({ id: productId, name: product.name, price: product.price, img: product.img, qty: Math.min(maxQty, qty) });
    }
    this.save();
    this.render();
    this.qty = 1;
    const qtyEl = document.getElementById('qtyNum');
    if (qtyEl) qtyEl.textContent = 1;
  }

  remove(productId) {
    this.items = this.items.filter(i => i.id !== productId);
    this.save();
    this.render();
  }

  changeQty(productId, delta) {
    const item = this.items.find(i => i.id === productId);
    if (!item) return;
    const product = PRODUCTS[productId];
    const maxQty = product?.maxQty || 10;
    item.qty = Math.min(maxQty, Math.max(1, item.qty + delta));
    this.save();
    this.render();
  }

  get count() { return this.items.reduce((a, i) => a + i.qty, 0); }
  get total() { return this.items.reduce((a, i) => a + i.price * i.qty, 0); }

  render() {
    const isJP = document.body.classList.contains('lang-jp');
    const countEl = document.getElementById('cartCount');
    if (countEl) {
      countEl.textContent = this.count;
      countEl.style.display = this.count > 0 ? 'flex' : 'none';
    }
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = '¥' + this.total.toLocaleString();
    const shippingEl = document.getElementById('cartShipping');
    if (shippingEl) {
      shippingEl.textContent = this.total > 0
        ? (isJP ? '日本国内送料無料・国際配送 ¥3,500' : 'Free in Japan · ¥3,500 international')
        : (isJP ? 'チェックアウト時に計算' : 'Calculated at checkout');
    }
    // Translate cart sidebar labels
    const cartTitleEl = document.getElementById('cartTitle');
    if (cartTitleEl) cartTitleEl.textContent = isJP ? 'カート' : 'CART';
    const cartTotalLabelEl = document.getElementById('cartTotalLabel');
    if (cartTotalLabelEl) cartTotalLabelEl.textContent = isJP ? '合計' : 'TOTAL';
    const cartShippingLabelEl = document.getElementById('cartShippingLabel');
    if (cartShippingLabelEl) cartShippingLabelEl.textContent = isJP ? '送料' : 'SHIPPING';

    const itemsEl = document.getElementById('cartItems');
    if (!itemsEl) return;
    if (this.items.length === 0) {
      itemsEl.innerHTML = `<div class="cart-empty">${isJP ? 'カートは空です' : 'YOUR CART IS EMPTY'}</div>`;
      return;
    }
    itemsEl.innerHTML = this.items.map(i => `
      <div class="cart-item">
        <img class="cart-item-img" src="${i.img}" alt="${i.name}" />
        <div class="cart-item-info">
          <div class="cart-item-name">${i.name}</div>
          <div class="cart-item-price">¥${(i.price * i.qty).toLocaleString()}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="cart.changeQty('${i.id}', -1)">−</button>
            <span class="qty-num">${i.qty}</span>
            <button class="qty-btn" onclick="cart.changeQty('${i.id}', 1)">+</button>
          </div>
        </div>
        <div class="cart-item-remove" onclick="cart.remove('${i.id}')">×</div>
      </div>
    `).join('');
  }
}

const cart = new BetonCart();

// ===================== CART UI =====================
function openCart() {
  document.getElementById('cartDrawer')?.classList.add('open');
  document.getElementById('overlay')?.classList.add('open');
}
function closeCart() {
  document.getElementById('cartDrawer')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('open');
}
function addToCart(productId) {
  const qty = parseInt(document.getElementById('qtyNum')?.textContent || '1');
  cart.add(productId, qty);
  openCart();
  showNotif(document.body.classList.contains('lang-jp') ? 'カートに追加しました' : 'ADDED TO CART');
}
function checkout() {
  if (cart.count === 0) return;
  window.location.href = '/checkout';
}

// ===================== QTY SELECTOR =====================
function changeQty(delta) {
  const el = document.getElementById('qtyNum');
  if (!el) return;
  const current = parseInt(el.textContent);
  const max = 10;
  el.textContent = Math.min(max, Math.max(1, current + delta));
}

// ===================== NOTIF =====================
function showNotif(msg) {
  const n = document.getElementById('notif');
  if (!n) return;
  n.textContent = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 2200);
}

// ===================== LANGUAGE TOGGLE =====================
function initLang() {
  const saved = localStorage.getItem('beton_lang') || 'en';
  if (saved === 'jp') {
    document.body.classList.add('lang-jp');
    const btn = document.getElementById('langBtn');
    if (btn) { btn.textContent = 'EN'; btn.classList.add('jp-active'); }
  }
}

function toggleLang() {
  const isJP = document.body.classList.contains('lang-jp');
  const btn = document.getElementById('langBtn');
  if (isJP) {
    document.body.classList.remove('lang-jp');
    localStorage.setItem('beton_lang', 'en');
    if (btn) { btn.textContent = 'JP'; btn.classList.remove('jp-active'); }
  } else {
    document.body.classList.add('lang-jp');
    localStorage.setItem('beton_lang', 'jp');
    if (btn) { btn.textContent = 'EN'; btn.classList.add('jp-active'); }
  }
  cart.render();
  document.dispatchEvent(new CustomEvent('beton:langchange'));
}

// ===================== SCROLL ANIMATIONS =====================
function initScrollAnimations() {
  const els = document.querySelectorAll('.fade-up, .fade-in');
  if (!els.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  els.forEach(el => observer.observe(el));
}

// ===================== IMAGE SWITCHER (product page) =====================
function switchImg(src, el) {
  const img = document.getElementById('mainImg');
  if (!img) return;
  img.style.opacity = 0;
  setTimeout(() => { img.src = src; img.style.opacity = 1; }, 180);
  document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ===================== LOADER (home only) =====================
function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return; // not on homepage — exit immediately, no listeners
  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hide');
      setTimeout(() => loader.remove(), 700);
    }, 1800);
  });
}

// ===================== NAV COMPONENT =====================
function initNav(active) {
  const el = document.getElementById('betonNav');
  if (!el) return;
  el.innerHTML = `
    <div class="overlay" id="overlay" onclick="closeCart()"></div>
    <div class="notif" id="notif"></div>
    <div class="cart-drawer" id="cartDrawer">
      <div class="cart-header">
        <div class="cart-title" id="cartTitle">CART</div>
        <div class="cart-close" onclick="closeCart()">×</div>
      </div>
      <div class="cart-items" id="cartItems"></div>
      <div class="cart-footer">
        <div class="cart-total"><span id="cartTotalLabel">TOTAL</span><span id="cartTotal">¥0</span></div>
        <div class="cart-shipping-line"><span id="cartShippingLabel">SHIPPING</span><span id="cartShipping">Calculated at checkout</span></div>
        <button class="checkout-btn" onclick="checkout()">
          <span data-lang="en">PROCEED TO CHECKOUT</span>
          <span data-lang="jp">購入手続きへ</span>
        </button>
      </div>
    </div>
    <nav class="nav">
      <a class="nav-logo" href="/">BE<span class="logo-slash">/</span>TON</a>
      <div class="nav-links">
        <a href="/shop"${active === 'shop' ? ' class="active"' : ''}>SHOP</a>
        <a href="/about"${active === 'about' ? ' class="active"' : ''}>ABOUT</a>
        <span class="cart-btn" onclick="openCart()">CART<span class="cart-count" id="cartCount" style="display:none">0</span></span>
        <div class="lang-toggle" onclick="toggleLang()" id="langBtn">JP</div>
      </div>
    </nav>
  `;
}

// Slim nav for checkout/success (no cart)
function initNavSlim() {
  const el = document.getElementById('betonNav');
  if (!el) return;
  el.innerHTML = `
    <nav class="nav">
      <a class="nav-logo" href="/">BE<span class="logo-slash">/</span>TON</a>
      <div class="nav-links">
        <a href="/shop">SHOP</a>
        <a href="/about">ABOUT</a>
        <div class="lang-toggle" onclick="toggleLang()" id="langBtn">JP</div>
      </div>
    </nav>
  `;
}

// ===================== FOOTER COMPONENT =====================
function initFooter() {
  const el = document.getElementById('betonFooter');
  if (!el) return;
  el.innerHTML = `
    <footer class="footer">
      <a class="footer-logo" href="/">BE<span class="logo-slash">/</span>TON</a>
      <div class="footer-mid">
        <div class="footer-location">KYOTO, JAPAN — <span class="kyoto">京都</span></div>
        <div class="footer-mid-links">
          <a class="footer-insta" href="https://instagram.com/betonkyoto" target="_blank" rel="noopener">@betonkyoto</a>
          <a class="footer-policy" href="/policy">
            <span data-lang="en">SHIPPING & RETURNS</span>
            <span data-lang="jp">配送・返品</span>
          </a>
        </div>
      </div>
    </footer>
  `;
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  const isCheckoutOrSuccess = path.includes('checkout') || path.includes('success');
  const active = path.includes('shop') || path.includes('strata') || path.includes('coming') ? 'shop'
               : path.includes('about') ? 'about' : '';

  if (isCheckoutOrSuccess) {
    initNavSlim();
  } else {
    initNav(active);
  }
  initFooter();

  initLang();
  cart.render();
  initScrollAnimations();
  initLoader();
});
