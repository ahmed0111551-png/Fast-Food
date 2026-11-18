/**
 * BurgerRush – script.js
 * Handles: Dark/Light Mode | Language Toggle (EN/AR, RTL) | 
 *          Navbar | Menu Filter | Smooth Scroll | Toast | Mobile Menu |
 *          Order Cart System | FormSubmit Integration
 */

(function() {
    'use strict';

    // ══════════════════════════════
    // CONSTANTS & STATE
    // ══════════════════════════════
    const html = document.documentElement;
    const navbar = document.getElementById('navbar');
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const langToggle = document.getElementById('langToggle');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    const menuGrid = document.getElementById('menuGrid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const toast = document.getElementById('toast');

    // Cart elements
    const cartBtn = document.getElementById('cartBtn');
    const cartClose = document.getElementById('cartClose');
    const cartPanel = document.getElementById('cartPanel');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartCount = document.getElementById('cartCount');
    const cartItemsList = document.getElementById('cartItemsList');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartTotalAmount = document.getElementById('cartTotalAmount');
    const orderForm = document.getElementById('orderForm');
    const orderDetailsField = document.getElementById('orderDetailsField');
    const cartSuccess = document.getElementById('cartSuccess');
    const cartError = document.getElementById('cartError');
    const cartSubmit = document.getElementById('cartSubmit');

    let currentTheme = localStorage.getItem('brTheme') || 'dark';
    let currentLang = localStorage.getItem('brLang') || 'en';
    let cartItems = JSON.parse(localStorage.getItem('brCart')) || [];

    const toastMessages = {
        en: (name) => `✅ "${name}" added to your order!`,
        ar: (name) => `✅ تمت إضافة "${name}" إلى طلبك!`,
    };

    // ══════════════════════════════
    // DARK / LIGHT MODE
    // ══════════════════════════════
    function applyTheme(theme) {
        html.setAttribute('data-theme', theme);
        const iconStr = theme === 'dark' ? '☀️' : '🌙';
        document.querySelectorAll('.theme-icon').forEach(el => {
            el.textContent = iconStr;
        });
        localStorage.setItem('brTheme', theme);
        currentTheme = theme;
    }

    themeToggle.addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    // ══════════════════════════════
    // LANGUAGE TOGGLE (EN / AR)
    // ══════════════════════════════
    function applyLanguage(lang) {
        html.setAttribute('data-lang', lang);
        html.setAttribute('lang', lang);
        html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

        document.querySelectorAll('[data-en]').forEach((el) => {
            const enText = el.getAttribute('data-en-text') || el.getAttribute('data-en');
            const arText = el.getAttribute('data-ar');
            if (!arText) return;
            el.textContent = lang === 'ar' ? arText : enText;
        });

        // Update the language label in the header.
        const labelStr = lang === 'ar' ? 'AR' : 'EN';
        document.getElementById('langLabel').textContent = labelStr;

        localStorage.setItem('brLang', lang);
        currentLang = lang;

        // Refresh cart display to update names
        renderCart();
    }

    langToggle.addEventListener('click', () => {
        applyLanguage(currentLang === 'en' ? 'ar' : 'en');
        closeMobileMenu();
    });

    // ══════════════════════════════
    // NAVBAR & MOBILE MENU
    // ══════════════════════════════
    function handleNavbarScroll() {
        if (window.scrollY > 40) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleNavbarScroll, {
        passive: true
    });

    const closeMobileMenu = () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
    };

    hamburger.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        hamburger.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', isOpen);
    });

    navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobileMenu));

    // ══════════════════════════════
    // CART PANEL TOGGLE
    // ══════════════════════════════
    function openCart() {
        cartPanel.classList.add('open');
        cartOverlay.classList.add('open');
        cartPanel.setAttribute('aria-hidden', 'false');
        cartOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Prevent scroll
    }

    function closeCart() {
        cartPanel.classList.remove('open');
        cartOverlay.classList.remove('open');
        cartPanel.setAttribute('aria-hidden', 'true');
        cartOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        // Reset form messages
        cartSuccess.classList.remove('show');
        cartError.classList.remove('show');
    }

    cartBtn.addEventListener('click', openCart);
    document.querySelectorAll('[data-open-cart]').forEach(el => el.addEventListener('click', openCart));
    cartClose.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

    // ══════════════════════════════
    // CART LOGIC
    // ══════════════════════════════
    function saveCart() {
        localStorage.setItem('brCart', JSON.stringify(cartItems));
        updateCartBadge();
    }

    function updateCartBadge() {
        const count = cartItems.reduce((acc, item) => acc + item.qty, 0);
        cartCount.textContent = count;
        const bbCount = document.getElementById('bbCartCount');
        if (bbCount) {
            bbCount.textContent = count;
            bbCount.classList.toggle('show', count > 0);
        }
        cartCount.classList.add('bump');
        setTimeout(() => cartCount.classList.remove('bump'), 300);
    }

    function renderCart() {
        if (cartItems.length === 0) {
            cartEmpty.classList.remove('hidden');
            cartItemsList.replaceChildren();
            cartTotalAmount.textContent = formatCurrency(0);
        } else {
            cartEmpty.classList.add('hidden');
            cartItemsList.replaceChildren(...cartItems.map((item, index) => {
                const row = document.createElement('li');
                row.className = 'cart-item';

                const info = document.createElement('div');
                info.className = 'cart-item-info';
                const name = document.createElement('div');
                name.className = 'cart-item-name';
                name.textContent = currentLang === 'ar' ? item.nameAr : item.nameEn;
                const price = document.createElement('div');
                price.className = 'cart-item-price';
                price.textContent = formatCurrency(item.price * item.qty);
                info.append(name, price);

                const controls = document.createElement('div');
                controls.className = 'cart-item-controls';
                const decrease = document.createElement('button');
                decrease.className = 'cart-qty-btn';
                decrease.type = 'button';
                decrease.textContent = '–';
                decrease.addEventListener('click', () => window.brUpdateQty(index, -1));
                const quantity = document.createElement('span');
                quantity.className = 'cart-item-qty';
                quantity.textContent = String(item.qty);
                const increase = document.createElement('button');
                increase.className = 'cart-qty-btn';
                increase.type = 'button';
                increase.textContent = '+';
                increase.addEventListener('click', () => window.brUpdateQty(index, 1));
                controls.append(decrease, quantity, increase);

                const remove = document.createElement('button');
                remove.className = 'cart-remove';
                remove.type = 'button';
                remove.setAttribute('aria-label', 'Remove item');
                remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
                remove.addEventListener('click', () => window.brRemoveItem(index));

                row.append(info, controls, remove);
                return row;
            }));

            const total = cartItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
            cartTotalAmount.textContent = formatCurrency(total);
        }
    }

    function formatCurrency(amount) {
        const currencySymbol = window.siteSettings?.currencySymbol || '$';
        return `${currencySymbol}${amount.toFixed(2)}`;
    }

    window.brUpdateQty = (index, delta) => {
        cartItems[index].qty += delta;
        if (cartItems[index].qty < 1) {
            cartItems.splice(index, 1);
        }
        saveCart();
        renderCart();
    };

    window.brRemoveItem = (index) => {
        cartItems.splice(index, 1);
        saveCart();
        renderCart();
    };

    function addToCart(nameEn, nameAr, price) {
        const existing = cartItems.find(item => item.nameEn === nameEn);
        if (existing) {
            existing.qty++;
        } else {
            cartItems.push({
                nameEn,
                nameAr,
                price,
                qty: 1
            });
        }
        saveCart();
        renderCart();
        showToast(toastMessages[currentLang](currentLang === 'ar' ? nameAr : nameEn));
    }

    // Bind Add Buttons
    menuGrid.addEventListener('click', (event) => {
        const btn = event.target.closest('.add-btn');
        if (btn) {
            const card = btn.closest('.menu-card');
            if (!card) return;
            const nameEl = card.querySelector('h3');
            const nameEn = nameEl.getAttribute('data-en') || nameEl.textContent.trim();
            const nameAr = nameEl.getAttribute('data-ar') || nameEn;
            const price = parseFloat(card.getAttribute('data-price')) || parseFloat(card.querySelector('.menu-price')?.textContent.replace(/[^\d.]/g, '')) || 0;

            addToCart(nameEn, nameAr, price);
        }
    });

    // ══════════════════════════════
    // FORM HANDLING (FORMSUBMIT)
    // ══════════════════════════════
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (cartItems.length === 0) return;

        // Reset messages
        cartSuccess.classList.remove('show');
        cartError.classList.remove('show');

        // Simple validation
        const name = document.getElementById('customerName');
        const phone = document.getElementById('customerPhone');
        const addr = document.getElementById('customerAddress');
        let isValid = true;

        [name, phone, addr].forEach(el => {
            const err = document.getElementById(`${el.id.replace('customer', '').toLowerCase()}Err`);
            if (!el.value.trim()) {
                el.classList.add('is-error');
                err?.classList.add('show');
                isValid = false;
            } else {
                el.classList.remove('is-error');
                err?.classList.remove('show');
            }
        });

        if (!isValid) return;

        // Build order details string for the hidden field
        const summary = cartItems.map(item => `${item.nameEn} (x${item.qty}) - ${formatCurrency(item.price * item.qty)}`).join('\n');
        const total = cartTotalAmount.textContent;
        orderDetailsField.value = `ORDER SUMMARY:\n${summary}\n\nTOTAL: ${total}`;

        // Submit via AJAX to FormSubmit
        cartSubmit.disabled = true;
        const initialText = cartSubmit.textContent;
        cartSubmit.textContent = currentLang === 'ar' ? 'جاري الإرسال...' : 'Sending...';

        try {
            const formData = new FormData(orderForm);
            const orderEmail = window.siteSettings?.email || 'ahmed0111551@gmail.com';
            const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(orderEmail)}`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                },
                body: formData
            });

            if (response.ok) {
                cartSuccess.classList.add('show');
                orderForm.reset();
                cartItems = [];
                saveCart();
                renderCart();
                setTimeout(closeCart, 4000);
            } else {
                throw new Error();
            }
        } catch (err) {
            cartError.classList.add('show');
        } finally {
            cartSubmit.disabled = false;
            cartSubmit.textContent = initialText;
        }
    });

    // ══════════════════════════════
    // HELPERS (TOAST, FILTER, SCROLL)
    // ══════════════════════════════
    let toastTimer = null;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
    }

    function filterMenu(category) {
        const cards = menuGrid.querySelectorAll('.menu-card');
        cards.forEach((card) => {
            const cat = card.getAttribute('data-category');
            if (category === 'all' || cat === category) {
                card.classList.remove('hidden');
                card.style.animation = 'none';
                requestAnimationFrame(() => card.style.animation = 'fadeUp 0.35s ease both');
            } else {
                card.classList.add('hidden');
            }
        });
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterMenu(btn.getAttribute('data-filter'));
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            const navHeight = navbar.offsetHeight;
            const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight;
            window.scrollTo({
                top: targetTop,
                behavior: 'smooth'
            });
        });
    });

    // Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeUp 0.5s ease both';
                entry.target.style.opacity = '1';
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -60px 0px'
    });

    document.querySelectorAll('.menu-card, .why-card, .review-card, .contact-card, .about-grid, .section-header')
        .forEach(el => {
            el.style.opacity = '0';
            observer.observe(el);
        });

    // ══════════════════════════════
    // INIT
    // ══════════════════════════════
    function init() {
        applyTheme(currentTheme);
        applyLanguage(currentLang);
        handleNavbarScroll();
        updateCartBadge();
        renderCart();
    }

    // Bottom bar: highlight the section currently in view
    (function bottomBarActive() {
        const items = document.querySelectorAll('.bottom-bar a.bb-item:not(.cta)[href^="#"]');
        if (!items.length || !('IntersectionObserver' in window)) return;
        const map = {};
        items.forEach(a => { map[a.getAttribute('href').slice(1)] = a; });
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting && map[e.target.id]) {
                    items.forEach(a => a.classList.remove('active'));
                    map[e.target.id].classList.add('active');
                }
            });
        }, { rootMargin: '-40% 0px -50% 0px' });
        Object.keys(map).forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    })();

    Promise.resolve(window.siteContentReady)
        .then(init)
        .catch((error) => {
            console.error('Site content initialization failed:', error);
            init();
        });

})();