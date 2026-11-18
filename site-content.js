(function () {
  'use strict';

  function textKey(en, ar) {
    return `${encodeURIComponent(en)}|${encodeURIComponent(ar)}`;
  }

  function addLocalizedText(parent, tag, className, en, ar) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.setAttribute('data-en', en);
    element.setAttribute('data-ar', ar);
    element.textContent = en;
    parent.appendChild(element);
    return element;
  }

  function renderMenu(items, currencySymbol) {
    const grid = document.getElementById('menuGrid');
    if (!grid) return;
    grid.replaceChildren();

    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'menu-card';
      card.dataset.category = item.category;
      card.dataset.price = String(item.price);

      const imageWrap = document.createElement('div');
      imageWrap.className = 'menu-card-img-wrap';
      const image = document.createElement('img');
      image.src = item.image;
      image.alt = item.nameEn;
      image.loading = 'lazy';
      imageWrap.appendChild(image);

      if (item.badgeEn || item.badgeAr) {
        const badge = addLocalizedText(
          imageWrap,
          'span',
          `menu-badge${item.badgeStyle ? ` ${item.badgeStyle}-badge` : ''}`,
          item.badgeEn,
          item.badgeAr,
        );
        if (item.badgeStyle === 'deal') badge.classList.add('deal-badge');
        if (item.badgeStyle === 'new') badge.classList.add('new-badge');
      }

      const body = document.createElement('div');
      body.className = 'menu-card-body';
      const top = document.createElement('div');
      top.className = 'menu-card-top';
      addLocalizedText(top, 'h3', '', item.nameEn, item.nameAr);
      const price = document.createElement('span');
      price.className = 'menu-price';
      price.textContent = `${currencySymbol}${Number(item.price).toFixed(2)}${item.priceSuffix || ''}`;
      top.appendChild(price);
      body.appendChild(top);

      addLocalizedText(body, 'p', '', item.descriptionEn, item.descriptionAr);
      const footer = document.createElement('div');
      footer.className = 'menu-card-footer';
      if (item.metaEn || item.metaAr) {
        const meta = document.createElement('span');
        meta.className = 'menu-meta';
        meta.append(document.createTextNode(item.metaIcon ? `${item.metaIcon} ` : ''));
        addLocalizedText(meta, 'span', '', item.metaEn, item.metaAr);
        footer.appendChild(meta);
      }
      const button = addLocalizedText(footer, 'button', 'add-btn', 'Add +', 'أضف +');
      button.type = 'button';
      button.setAttribute('aria-label', 'Add to order');
      button.setAttribute('data-en', 'Add');
      button.setAttribute('data-ar', 'أضف');
      body.appendChild(footer);

      card.append(imageWrap, body);
      grid.appendChild(card);
    });
  }

  function applySettings(settings) {
    const nameEn = settings.restaurantName;
    const nameAr = settings.restaurantNameAr;
    if (nameEn && nameAr) {
      document.querySelectorAll('.logo-text').forEach((logo) => {
        logo.setAttribute('data-en', nameEn);
        logo.setAttribute('data-ar', nameAr);
        logo.textContent = document.documentElement.dataset.lang === 'ar' ? nameAr : nameEn;
      });
      document.title = nameEn;
    }

    if (settings.phone) {
      const phoneLink = `tel:${settings.phone.replace(/[^\d+]/g, '')}`;
      document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
        link.href = phoneLink;
        if (link.closest('.contact-list')) link.textContent = settings.phone;
      });
    }

    if (settings.email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
        link.href = `mailto:${settings.email}`;
        if (link.closest('.contact-list')) link.textContent = settings.email;
      });
    }

    for (const network of ['instagram', 'facebook', 'tiktok']) {
      const link = document.querySelector(`.footer-social a[aria-label="${network}"]`);
      if (link && settings[network] !== undefined) {
        link.href = settings[network] || '#';
        link.hidden = !settings[network];
      }
    }
  }

  async function loadContent() {
    try {
      const response = await fetch('/api/site-content', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Content request failed (${response.status}).`);
      const data = await response.json();
      const texts = data.texts && typeof data.texts === 'object' ? data.texts : {};

      document.querySelectorAll('[data-en][data-ar]').forEach((element) => {
        if (element.classList.contains('logo-text')) return;
        const originalEn = element.getAttribute('data-en');
        const originalAr = element.getAttribute('data-ar');
        const replacement = texts[textKey(originalEn, originalAr)];
        if (!replacement || typeof replacement.en !== 'string' || typeof replacement.ar !== 'string') return;
        element.setAttribute('data-en', replacement.en);
        element.setAttribute('data-ar', replacement.ar);
      });

      window.siteSettings = data.settings && typeof data.settings === 'object' ? data.settings : {};
      applySettings(window.siteSettings);
      const currencySymbol = window.siteSettings.currencySymbol || '$';
      if (Array.isArray(data.menu)) {
        renderMenu(data.menu, currencySymbol);
      } else {
        document.querySelectorAll('#menuGrid .menu-card').forEach((card) => {
          const price = card.querySelector('.menu-price');
          if (!price) return;
          const amount = Number.parseFloat(price.textContent.replace(/[^\d.]/g, ''));
          if (Number.isFinite(amount)) {
            const suffix = price.textContent.replace(/[\d\s.,$]/g, '');
            card.dataset.price = String(amount);
            price.textContent = `${currencySymbol}${amount.toFixed(2)}${suffix}`;
          }
        });
      }
    } catch (error) {
      window.siteSettings = {};
      console.error('Could not load saved site content; showing the published defaults.', error);
    }
  }

  window.siteContentReady = loadContent();
})();
