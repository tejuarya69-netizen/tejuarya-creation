// ToyVerse - Toy Shopping Experience
// Core logic: product data, rendering, search/sort/filter, cart with localStorage, modal, cart drawer, checkout

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const state = {
    products: [],
    filteredProducts: [],
    category: 'all',
    sort: 'popular',
    search: '',
    cart: new Map(), // key: id, value: { product, qty }
    route: '#/home',
    page: 1,
    pageSize: 8,
    infinite: true,
};

const STORAGE_KEYS = {
	cart: 'toyverse.cart.v1',
	theme: 'toyverse.theme.v1',
};

function loadCartFromStorage() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.cart);
		if (!raw) return;
		const parsed = JSON.parse(raw);
		parsed.forEach(item => {
			state.cart.set(item.product.id, { product: item.product, qty: item.qty });
		});
	} catch {}
}

function saveCartToStorage() {
	const arr = Array.from(state.cart.values()).map(v => ({ product: v.product, qty: v.qty }));
	localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(arr));
}

function setTheme(theme) {
	const root = document.documentElement;
	root.setAttribute('data-theme', theme);
	localStorage.setItem(STORAGE_KEYS.theme, theme);
	const icon = $('.theme-icon');
	if (icon) icon.textContent = theme === 'dark' ? '🌙' : '🌞';
}

function initTheme() {
	const stored = localStorage.getItem(STORAGE_KEYS.theme);
	if (stored === 'light' || stored === 'dark') {
		setTheme(stored);
		return;
	}
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	setTheme(prefersDark ? 'dark' : 'light');
}

// Sample product data (images via picsum placeholders)
const PRODUCT_DATA = [
	{ id: 'p1', title: 'RoboKit Junior', category: 'STEM', price: 39.99, rating: 4.7, popular: true, createdAt: 20240202, image: 'https://picsum.photos/seed/robokit/600/400', desc: 'Build-and-play robotics kit that teaches fundamentals of mechanics and coding.' },
	{ id: 'p2', title: 'CuddleBear Plush', category: 'Plush', price: 19.5, rating: 4.6, popular: true, createdAt: 20240510, image: 'https://picsum.photos/seed/bear/600/400', desc: 'Ultra-soft hypoallergenic plush bear that gives the best cuddles.' },
	{ id: 'p3', title: 'Adventure Kite', category: 'Outdoor', price: 24.0, rating: 4.4, popular: false, createdAt: 20240110, image: 'https://picsum.photos/seed/kite/600/400', desc: 'High-flying kite with durable frame for breezy outdoor fun.' },
	{ id: 'p4', title: 'BrainTease 500', category: 'Puzzles', price: 16.75, rating: 4.1, popular: false, createdAt: 20240312, image: 'https://picsum.photos/seed/puzzle/600/400', desc: '500-piece colorful puzzle to unwind and sharpen the mind.' },
	{ id: 'p5', title: 'Circuit Lab Pro', category: 'STEM', price: 54.0, rating: 4.8, popular: true, createdAt: 20240601, image: 'https://picsum.photos/seed/circuit/600/400', desc: 'Hands-on electronics kit with safe snap components.' },
	{ id: 'p6', title: 'DinoBuddy', category: 'Plush', price: 22.99, rating: 4.5, popular: true, createdAt: 20240422, image: 'https://picsum.photos/seed/dino/600/400', desc: 'Friendly dinosaur plush for imaginative adventures.' },
	{ id: 'p7', title: 'Rainbow Skipping Rope', category: 'Outdoor', price: 8.99, rating: 4.3, popular: false, createdAt: 20240125, image: 'https://picsum.photos/seed/rope/600/400', desc: 'Colorful rope to keep kids active and smiling.' },
	{ id: 'p8', title: 'MindBlocks', category: 'Puzzles', price: 29.0, rating: 4.6, popular: true, createdAt: 20240222, image: 'https://picsum.photos/seed/blocks/600/400', desc: 'Modular puzzle blocks that snap in satisfying ways.' },
];

function formatPrice(n) { return `$${n.toFixed(2)}`; }

function renderProductsGrid(container, products) {
    container.setAttribute('aria-busy', 'true');
    const frag = document.createDocumentFragment();
    products.forEach(p => {
		const card = document.createElement('article');
		card.className = 'product-card';
		card.innerHTML = `
			<div class="product-media"><img src="${p.image}" alt="${p.title}" loading="lazy"></div>
			<div class="product-body">
				<div class="title">${p.title}</div>
				<div class="muted">${p.category} • ⭐ ${p.rating}</div>
				<div class="price-row">
					<span class="price">${formatPrice(p.price)}</span>
					<span class="pill">${p.popular ? 'Bestseller' : 'Fresh pick'}</span>
				</div>
				<div class="actions">
					<button class="btn btn-primary" data-add="${p.id}">Add to cart</button>
					<button class="btn btn-ghost" data-view="${p.id}">Quick view</button>
				</div>
			</div>`;
		frag.appendChild(card);
	});
    container.appendChild(frag);
    container.setAttribute('aria-busy', 'false');
}

function applyFilters() {
	const q = state.search.trim().toLowerCase();
	let list = state.products.filter(p => state.category === 'all' ? true : p.category === state.category);
	if (q) list = list.filter(p => p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
	switch (state.sort) {
		case 'price-asc': list.sort((a,b) => a.price - b.price); break;
		case 'price-desc': list.sort((a,b) => b.price - a.price); break;
		case 'new': list.sort((a,b) => b.createdAt - a.createdAt); break;
		default: list.sort((a,b) => Number(b.popular) - Number(a.popular));
	}
    state.filteredProducts = list;
    renderCurrentRoute();
}

function showToast(msg) {
	const el = $('#toast');
	if (!el) return;
	el.textContent = msg;
	el.classList.add('show');
	setTimeout(() => el.classList.remove('show'), 1600);
}

function updateCartCount() {
	const count = Array.from(state.cart.values()).reduce((acc, v) => acc + v.qty, 0);
	$('#cartCount').textContent = String(count);
}

function addToCart(productId, qty = 1) {
	const product = state.products.find(p => p.id === productId);
	if (!product) return;
	const existing = state.cart.get(productId);
	if (existing) existing.qty += qty; else state.cart.set(productId, { product, qty });
	saveCartToStorage();
	updateCartUI();
	showToast('Added to cart');
}

function removeFromCart(productId) {
	state.cart.delete(productId);
	saveCartToStorage();
	updateCartUI();
}

function setCartQty(productId, qty) {
	const item = state.cart.get(productId);
	if (!item) return;
	item.qty = Math.max(1, qty);
	saveCartToStorage();
	updateCartUI();
}

function cartSubtotal() {
	return Array.from(state.cart.values()).reduce((sum, v) => sum + v.product.price * v.qty, 0);
}

function renderCartItems() {
	const list = $('#cartItems');
	list.innerHTML = '';
	if (state.cart.size === 0) {
		list.innerHTML = '<p class="muted">Your cart is feeling empty.</p>';
		$('#cartSubtotal').textContent = formatPrice(0);
		return;
	}
	const frag = document.createDocumentFragment();
	state.cart.forEach(({ product, qty }) => {
		const row = document.createElement('div');
		row.className = 'drawer-item';
		row.innerHTML = `
			<img src="${product.image}" alt="${product.title}" width="72" height="54" />
			<div>
				<div class="title">${product.title}</div>
				<div class="muted">${formatPrice(product.price)}</div>
			</div>
			<div style="display:grid; gap:6px; justify-items:end;">
				<div class="qty">
					<button data-dec="${product.id}" aria-label="Decrease">−</button>
					<input data-qty="${product.id}" value="${qty}" inputmode="numeric" aria-label="Quantity" />
					<button data-inc="${product.id}" aria-label="Increase">+</button>
				</div>
				<button class="btn btn-ghost" data-remove="${product.id}">Remove</button>
			</div>`;
		frag.appendChild(row);
	});
	list.appendChild(frag);
	$('#cartSubtotal').textContent = formatPrice(cartSubtotal());
}

function updateCartUI() { updateCartCount(); renderCartItems(); renderCurrentRoute(); }

// Drawer removed in favor of cart page
function openDrawer() {}
function closeDrawer() {}

function openModal(product) {
	const dlg = $('#productModal');
	$('#modalTitle').textContent = product.title;
	$('#modalDesc').textContent = product.desc;
	$('#modalPrice').textContent = formatPrice(product.price);
	$('#modalImage').src = product.image;
	$('#modalAdd').onclick = () => { addToCart(product.id, 1); dlg.close(); };
	if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

function closeModal() {
	const dlg = $('#productModal');
	if (dlg.open) dlg.close(); else dlg.removeAttribute('open');
}

function wireGlobalEvents() {
	// Search
	$('#searchInput').addEventListener('input', (e) => { state.search = e.target.value; applyFilters(); });
	$('#clearSearch').addEventListener('click', () => { $('#searchInput').value = ''; state.search = ''; applyFilters(); });

	// Sort
	$('#sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; applyFilters(); });

	// Category chips
	$$('.chip').forEach(chip => chip.addEventListener('click', () => {
		$$('.chip').forEach(c => { c.classList.remove('is-active'); c.setAttribute('aria-selected', 'false'); });
		chip.classList.add('is-active'); chip.setAttribute('aria-selected', 'true');
		state.category = chip.dataset.category;
		applyFilters();
	}));

	// Products container delegation
	$('#products').addEventListener('click', (e) => {
		const add = e.target.closest('[data-add]');
		if (add) { addToCart(add.getAttribute('data-add')); return; }
		const view = e.target.closest('[data-view]');
		if (view) { const p = state.products.find(x => x.id === view.getAttribute('data-view')); if (p) openModal(p); }
	});

	// Modal close
	$$('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
	$('#productModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });

    // Escape closes modal
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); } });

    // Drawer delegation (kept for modal cart controls reuse if present)
    const cartItems = $('#cartItems');
    if (cartItems) cartItems.addEventListener('click', (e) => {
		const inc = e.target.closest('[data-inc]');
		if (inc) { const id = inc.getAttribute('data-inc'); const item = state.cart.get(id); if (item) setCartQty(id, item.qty + 1); return; }
		const dec = e.target.closest('[data-dec]');
		if (dec) { const id = dec.getAttribute('data-dec'); const item = state.cart.get(id); if (item) setCartQty(id, Math.max(1, item.qty - 1)); return; }
		const rem = e.target.closest('[data-remove]');
		if (rem) { removeFromCart(rem.getAttribute('data-remove')); return; }
    });
    if (cartItems) cartItems.addEventListener('input', (e) => {
		const qtyEl = e.target.closest('[data-qty]');
		if (!qtyEl) return;
		const id = qtyEl.getAttribute('data-qty');
		const val = parseInt(qtyEl.value.replace(/\D/g, ''), 10);
		if (!Number.isNaN(val)) setCartQty(id, val);
	});

	// Checkout stub
    // Cart page checkout handled via router rendering

	// Surprise me focuses a random product
    document.addEventListener('click', (e) => {
        const surprise = e.target.closest('#surpriseMe');
        if (surprise) {
            const idx = Math.floor(Math.random() * state.filteredProducts.length);
            const cards = $$('#app .product-card');
            const el = cards[idx];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

	// Theme
	$('#themeToggle').addEventListener('click', () => {
		const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
		setTheme(isDark ? 'light' : 'dark');
		$('#themeToggle').setAttribute('aria-pressed', String(!isDark));
	});
}

function init() {
	initTheme();
	state.products = PRODUCT_DATA;
	loadCartFromStorage();
    applyFilters();
    updateCartUI();
	$('#year').textContent = new Date().getFullYear();
    wireGlobalEvents();
    initRouter();
}

document.addEventListener('DOMContentLoaded', init);

// ------------- SPA Router and Pages -------------
function initRouter() {
    window.addEventListener('hashchange', onRouteChange);
    if (!location.hash) location.hash = '#/home';
    onRouteChange();
}

function onRouteChange() {
    state.route = location.hash || '#/home';
    renderCurrentRoute();
}

function renderCurrentRoute() {
    const app = $('#app');
    const [_, route, param] = state.route.split('/'); // e.g. #/categories/STEM
    if (!app) return;
    if (route === 'home') return renderHome(app);
    if (route === 'categories') return renderCategory(app, param || 'all');
    if (route === 'product') return renderProductDetail(app, param);
    if (route === 'cart') return renderCartPage(app);
    if (route === 'about') return renderAbout(app);
    return renderNotFound(app);
}

function renderHome(app) {
    app.innerHTML = `
        <section class="hero">
            <div class="carousel" aria-label="Promotions">
                <div class="carousel-track" id="carouselTrack">
                    <div class="slide" style="background:linear-gradient(120deg, rgba(124,77,255,.15), transparent), var(--surface-2)"><h2>Discover Joy in Every Toy</h2></div>
                    <div class="slide" style="background:linear-gradient(120deg, rgba(255,122,195,.15), transparent), var(--surface-2)"><h2>STEM Kits that Inspire</h2></div>
                    <div class="slide" style="background:linear-gradient(120deg, rgba(22,196,127,.15), transparent), var(--surface-2)"><h2>Soft Plush, Big Hugs</h2></div>
                </div>
                <div class="carousel-dots" id="carouselDots"></div>
            </div>
        </section>
        <section class="filters" aria-label="Filter products">
            <div class="chips" role="tablist" aria-label="Categories">
                <button class="chip ${state.category==='all'?'is-active':''}" role="tab" aria-selected="${state.category==='all'}" data-category="all">All</button>
                <button class="chip ${state.category==='STEM'?'is-active':''}" role="tab" aria-selected="${state.category==='STEM'}" data-category="STEM">STEM</button>
                <button class="chip ${state.category==='Plush'?'is-active':''}" role="tab" aria-selected="${state.category==='Plush'}" data-category="Plush">Plush</button>
                <button class="chip ${state.category==='Outdoor'?'is-active':''}" role="tab" aria-selected="${state.category==='Outdoor'}" data-category="Outdoor">Outdoor</button>
                <button class="chip ${state.category==='Puzzles'?'is-active':''}" role="tab" aria-selected="${state.category==='Puzzles'}" data-category="Puzzles">Puzzles</button>
            </div>
        </section>
        <section class="section">
            <div id="products" class="products" aria-live="polite" aria-busy="false"></div>
            <div class="pagination">
                <button id="loadMore" class="btn btn-ghost">Load More</button>
            </div>
        </section>
        <section class="features section">
            <h2>Why shop with ToyVerse?</h2>
            <div class="cards">
                <div class="card"><strong>Curated Quality</strong><p class="muted">Only safe, tested, and loved toys.</p></div>
                <div class="card"><strong>Fast Shipping</strong><p class="muted">From our warehouse to your door.</p></div>
                <div class="card"><strong>Playful Support</strong><p class="muted">We’re here for every giggle.</p></div>
            </div>
        </section>
        <section class="testimonials section">
            <h2>What customers say</h2>
            <div class="cards">
                <div class="card">“My kid can’t stop building. 10/10!” — Alex</div>
                <div class="card">“Plush is unbelievably soft.” — Priya</div>
                <div class="card">“Great service and selection.” — Mateo</div>
            </div>
        </section>
        <section class="brands section"><h2>Brands we carry</h2><div class="cards"><div class="card">ToyVerse Originals</div><div class="card">MakerKids</div><div class="card">PlayLab</div></div></section>
        <section class="faq section"><h2>FAQ</h2><div class="cards"><div class="card"><strong>Shipping?</strong><p class="muted">2-5 business days.</p></div><div class="card"><strong>Returns?</strong><p class="muted">30-day window.</p></div><div class="card"><strong>Age ranges?</strong><p class="muted">Listed on each product.</p></div></div></section>
        <section class="newsletter section" aria-labelledby="newsletter-heading">
            <div class="nl-card">
                <h2 id="newsletter-heading">Join our PlayLetter</h2>
                <p>Get fresh arrivals, deals, and playful picks in your inbox.</p>
                <form id="newsletterForm" class="nl-form" novalidate>
                    <label class="sr-only" for="nlEmail">Email</label>
                    <input id="nlEmail" type="email" placeholder="you@example.com" required />
                    <button type="submit" class="btn btn-primary">Subscribe</button>
                </form>
            </div>
        </section>`;

    // Render products paginated
    const start = 0;
    const end = Math.min(state.page * state.pageSize, state.filteredProducts.length);
    renderProductsGrid($('#products'), state.filteredProducts.slice(start, end));
    const loadMore = $('#loadMore');
    const maybeLoad = () => {
        if (end >= state.filteredProducts.length) loadMore.disabled = true;
        else loadMore.disabled = false;
    };
    maybeLoad();
    loadMore.onclick = () => { state.page += 1; renderCurrentRoute(); };
    if (state.infinite) {
        const io = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) { state.page += 1; renderCurrentRoute(); }
        }, { rootMargin: '100px' });
        io.observe(loadMore);
    }

    // Carousel dots
    initCarousel();
}

function renderCategory(app, category) {
    state.category = category === 'all' ? 'all' : category;
    app.innerHTML = `
        <section class="section">
            <h2>${category === 'all' ? 'All Products' : category}</h2>
            <div id="products" class="products" aria-live="polite" aria-busy="false"></div>
        </section>`;
    renderProductsGrid($('#products'), state.filteredProducts);
}

function renderProductDetail(app, id) {
    const p = state.products.find(x => x.id === id) || state.products[0];
    app.innerHTML = `
        <section class="section">
            <div class="modal-body" style="grid-template-columns: 1fr 1fr;">
                <div class="modal-media"><img src="${p.image}" alt="${p.title}"></div>
                <div class="modal-info">
                    <h3>${p.title}</h3>
                    <p class="muted">${p.desc}</p>
                    <div class="price-row"><span class="price">${formatPrice(p.price)}</span><button class="btn btn-primary" data-add="${p.id}">Add to cart</button></div>
                </div>
            </div>
        </section>`;
}

function renderCartPage(app) {
    const items = Array.from(state.cart.values());
    app.innerHTML = `
        <section class="cart-page">
            <h2>Your Cart</h2>
            <div id="cartLines"></div>
            <div class="cart-summary">
                <div class="price-row"><span>Subtotal</span><strong id="cartSubtotal">${formatPrice(cartSubtotal())}</strong></div>
                <button id="checkoutBtn" class="btn btn-primary full">Checkout</button>
            </div>
        </section>`;
    const lines = $('#cartLines');
    if (items.length === 0) { lines.innerHTML = '<p class="muted">Your cart is feeling empty.</p>'; }
    else {
        const frag = document.createDocumentFragment();
        items.forEach(({ product, qty }) => {
            const d = document.createElement('div');
            d.className = 'cart-line';
            d.innerHTML = `
                <img src="${product.image}" alt="${product.title}" width="80" height="60"/>
                <div><div class="title">${product.title}</div><div class="muted">${formatPrice(product.price)}</div></div>
                <div class="qty"><button data-dec="${product.id}">−</button><input data-qty="${product.id}" value="${qty}" /><button data-inc="${product.id}">+</button></div>
                <button class="btn btn-ghost" data-remove="${product.id}">Remove</button>`;
            frag.appendChild(d);
        });
        lines.appendChild(frag);
        lines.addEventListener('click', (e) => {
            const inc = e.target.closest('[data-inc]'); if (inc) { const id=inc.getAttribute('data-inc'); const it=state.cart.get(id); if (it) setCartQty(id, it.qty+1); }
            const dec = e.target.closest('[data-dec]'); if (dec) { const id=dec.getAttribute('data-dec'); const it=state.cart.get(id); if (it) setCartQty(id, Math.max(1, it.qty-1)); }
            const rem = e.target.closest('[data-remove]'); if (rem) removeFromCart(rem.getAttribute('data-remove'));
        });
        lines.addEventListener('input', (e) => {
            const qtyEl = e.target.closest('[data-qty]'); if (!qtyEl) return;
            const id = qtyEl.getAttribute('data-qty'); const val = parseInt(qtyEl.value.replace(/\D/g, ''), 10); if (!Number.isNaN(val)) setCartQty(id, val);
        });
    }
    $('#checkoutBtn').addEventListener('click', () => {
        if (state.cart.size === 0) { showToast('Your cart is empty'); return; }
        const orderId = Math.random().toString(36).slice(2,8).toUpperCase();
        state.cart.clear(); saveCartToStorage(); updateCartUI(); showToast(`Order ${orderId} placed!`);
        location.hash = '#/home';
    });
}

function renderAbout(app) {
    app.innerHTML = `
        <section class="section">
            <h2>About ToyVerse</h2>
            <p class="muted">We curate toys that spark joy and growth. Built with love.</p>
        </section>`;
}

function renderNotFound(app) { app.innerHTML = `<section class="section"><h2>Page not found</h2></section>`; }

function initCarousel() {
    const track = $('#carouselTrack');
    const dots = $('#carouselDots');
    if (!track || !dots) return;
    const slides = $$('.slide', track);
    dots.innerHTML = '';
    slides.forEach((_, i) => {
        const d = document.createElement('button'); d.className = 'dot' + (i===0?' is-active':''); d.setAttribute('aria-label', `Slide ${i+1}`); d.addEventListener('click', () => go(i)); dots.appendChild(d);
    });
    let idx = 0, timer;
    function go(i) {
        idx = i % slides.length; if (idx < 0) idx = slides.length - 1;
        track.style.transform = `translateX(${-idx * 100}%)`;
        $$('.dot', dots).forEach((el, n) => el.classList.toggle('is-active', n===idx));
        restart();
    }
    function next() { go(idx+1); }
    function restart() { clearInterval(timer); timer = setInterval(next, 4000); }
    restart();
}
