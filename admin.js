(function () {
  'use strict';

  const loginPanel = document.getElementById('loginPanel');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginNotice = document.getElementById('loginNotice');
  const saveStatus = document.getElementById('saveStatus');
  const textList = document.getElementById('textList');
  const menuList = document.getElementById('menuList');
  const settingsForm = document.getElementById('settingsFields');
  const textDefaults = new Map();
  let state = { texts: {}, settings: {}, menu: [] };
  let defaults = { settings: {}, menu: [] };

  function textKey(en, ar) {
    return `${encodeURIComponent(en)}|${encodeURIComponent(ar)}`;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `تعذر إكمال الطلب (${response.status}).`);
    return body;
  }

  function readDefaultMenu(doc) {
    return [...doc.querySelectorAll('#menuGrid .menu-card')].map((card, index) => {
      const title = card.querySelector('h3');
      const description = card.querySelector('.menu-card-body > p');
      const image = card.querySelector('.menu-card-img-wrap img');
      const priceElement = card.querySelector('.menu-price');
      const badge = card.querySelector('.menu-badge');
      const meta = card.querySelector('.menu-meta');
      const metaText = meta?.querySelector('[data-en]');
      const priceLabel = priceElement?.textContent.trim() || '$0';
      const amount = Number.parseFloat(priceLabel.replace(/[^\d.]/g, '')) || 0;
      const metaIcon = meta?.firstChild?.textContent?.trim() || '';

      return {
        id: `menu-${index + 1}`,
        category: card.dataset.category || 'burgers',
        nameEn: title?.getAttribute('data-en') || title?.textContent.trim() || '',
        nameAr: title?.getAttribute('data-ar') || title?.textContent.trim() || '',
        descriptionEn: description?.getAttribute('data-en') || description?.textContent.trim() || '',
        descriptionAr: description?.getAttribute('data-ar') || description?.textContent.trim() || '',
        price: amount,
        priceSuffix: priceLabel.replace(/[\d\s.,$]/g, ''),
        image: image?.getAttribute('src') || 'menu_burger.png',
        badgeEn: badge?.getAttribute('data-en') || '',
        badgeAr: badge?.getAttribute('data-ar') || '',
        badgeStyle: badge?.classList.contains('new-badge') ? 'new' : badge?.classList.contains('deal-badge') ? 'deal' : '',
        metaIcon,
        metaEn: metaText?.getAttribute('data-en') || '',
        metaAr: metaText?.getAttribute('data-ar') || '',
      };
    });
  }

  async function readDefaults() {
    const response = await fetch('/index.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('تعذر تحميل بيانات الموقع الافتراضية.');
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    for (const element of doc.querySelectorAll('[data-en][data-ar]')) {
      if (element.classList.contains('logo-text') || element.closest('#menuGrid')) continue;
      const en = element.getAttribute('data-en');
      const ar = element.getAttribute('data-ar');
      const key = textKey(en, ar);
      if (!textDefaults.has(key)) textDefaults.set(key, { en, ar });
    }

    const logo = doc.querySelector('.logo-text');
    const phone = doc.querySelector('.contact-list a[href^="tel:"]');
    const email = doc.querySelector('.contact-list a[href^="mailto:"]');
    defaults = {
      settings: {
        restaurantName: logo?.getAttribute('data-en') || 'Fast Food',
        restaurantNameAr: logo?.getAttribute('data-ar') || 'فاست فود',
        phone: phone?.textContent.trim() || '',
        email: email?.textContent.trim() || '',
        currencySymbol: '$',
        instagram: doc.querySelector('.footer-social a[aria-label="Instagram"]')?.getAttribute('href') || '',
        facebook: doc.querySelector('.footer-social a[aria-label="Facebook"]')?.getAttribute('href') || '',
        tiktok: doc.querySelector('.footer-social a[aria-label="TikTok"]')?.getAttribute('href') || '',
      },
      menu: readDefaultMenu(doc),
    };
  }

  function renderSettings() {
    for (const input of settingsForm.querySelectorAll('[name]')) {
      input.value = state.settings[input.name] ?? '';
    }
  }

  function renderTexts() {
    const query = document.getElementById('textSearch').value.trim().toLowerCase();
    textList.replaceChildren();
    const entries = [...textDefaults.entries()].filter(([, value]) =>
      !query || `${value.en} ${value.ar}`.toLowerCase().includes(query),
    );
    if (!entries.length) {
      textList.innerHTML = '<div class="empty-state">لا توجد نصوص مطابقة.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const [key, original] of entries) {
      const value = state.texts[key] || original;
      const row = document.createElement('div');
      row.className = 'text-row';
      row.dataset.key = key;
      const title = document.createElement('p');
      title.className = 'text-row-title';
      title.textContent = original.en;
      row.appendChild(title);
      const fields = document.createElement('div');
      fields.className = 'text-row-fields';
      for (const [language, label] of [['en', 'الإنجليزية'], ['ar', 'العربية']]) {
        const field = document.createElement('label');
        field.textContent = label;
        const input = document.createElement('textarea');
        input.value = value[language];
        input.maxLength = 5000;
        input.dataset.language = language;
        field.appendChild(input);
        fields.appendChild(field);
      }
      row.appendChild(fields);
      fragment.appendChild(row);
    }
    textList.appendChild(fragment);
  }

  function createMenuField(item, index, key, label, options = {}) {
    const field = document.createElement('label');
    field.textContent = label;
    if (options.wide) field.classList.add('wide');
    let input;
    if (options.select) {
      input = document.createElement('select');
      for (const [value, title] of [['burgers', 'برغر'], ['sides', 'مقبلات'], ['combos', 'وجبات'], ['drinks', 'مشروبات']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = title;
        input.appendChild(option);
      }
    } else if (options.textarea) {
      input = document.createElement('textarea');
    } else {
      input = document.createElement('input');
      input.type = options.number ? 'number' : 'text';
      if (options.number) {
        input.min = '0';
        input.max = '100000';
        input.step = '0.01';
      }
    }
    input.value = item[key] ?? '';
    input.maxLength = options.number ? 16 : 2048;
    input.dataset.index = String(index);
    input.dataset.field = key;
    field.appendChild(input);
    return field;
  }

  function renderMenu() {
    menuList.replaceChildren();
    if (!state.menu.length) {
      menuList.innerHTML = '<div class="empty-state">المنيو فارغ. استخدم «إضافة صنف» لإضافة أول صنف.</div>';
      return;
    }

    state.menu.forEach((item, index) => {
      const details = document.createElement('details');
      details.className = 'menu-editor';
      const summary = document.createElement('summary');
      const title = document.createElement('span');
      title.textContent = item.nameAr || item.nameEn || `صنف ${index + 1}`;
      const category = document.createElement('span');
      category.textContent = item.category;
      summary.append(title, category);
      details.appendChild(summary);

      const fields = document.createElement('div');
      fields.className = 'menu-fields';
      fields.append(
        createMenuField(item, index, 'nameEn', 'اسم الصنف بالإنجليزية'),
        createMenuField(item, index, 'nameAr', 'اسم الصنف بالعربية'),
        createMenuField(item, index, 'category', 'التصنيف', { select: true }),
        createMenuField(item, index, 'price', 'السعر', { number: true }),
        createMenuField(item, index, 'descriptionEn', 'الوصف بالإنجليزية', { textarea: true, wide: true }),
        createMenuField(item, index, 'descriptionAr', 'الوصف بالعربية', { textarea: true, wide: true }),
        createMenuField(item, index, 'image', 'مسار الصورة أو رابط HTTPS', { wide: true }),
        createMenuField(item, index, 'priceSuffix', 'علامة بعد السعر (اختياري)'),
        createMenuField(item, index, 'metaIcon', 'رمز / أيقونة'),
        createMenuField(item, index, 'metaEn', 'ملاحظة بالإنجليزية'),
        createMenuField(item, index, 'metaAr', 'ملاحظة بالعربية'),
        createMenuField(item, index, 'badgeEn', 'شارة بالإنجليزية'),
        createMenuField(item, index, 'badgeAr', 'شارة بالعربية'),
      );

      const badgeStyle = document.createElement('label');
      badgeStyle.textContent = 'شكل الشارة';
      const select = document.createElement('select');
      select.dataset.index = String(index);
      select.dataset.field = 'badgeStyle';
      for (const [value, label] of [['', 'عادية'], ['new', 'جديد'], ['deal', 'عرض']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      }
      select.value = item.badgeStyle || '';
      badgeStyle.appendChild(select);
      fields.appendChild(badgeStyle);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-button';
      deleteButton.dataset.deleteIndex = String(index);
      deleteButton.textContent = 'حذف الصنف';
      fields.appendChild(deleteButton);
      details.appendChild(fields);
      menuList.appendChild(details);
    });
  }

  async function showDashboard() {
    const [saved] = await Promise.all([
      request('/api/admin/data'),
      readDefaults(),
    ]);
    state.texts = saved.data.texts || {};
    state.settings = { ...defaults.settings, ...(saved.data.settings || {}) };
    state.menu = Array.isArray(saved.data.menu) ? saved.data.menu : defaults.menu;
    renderSettings();
    renderTexts();
    renderMenu();
    loginPanel.hidden = true;
    dashboard.hidden = false;
  }

  function showError(element, error) {
    element.textContent = error.message || 'حدث خطأ. حاول مرة أخرى.';
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginNotice.textContent = '';
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: document.getElementById('password').value }),
      });
      document.getElementById('password').value = '';
      await showDashboard();
    } catch (error) {
      showError(loginNotice, error);
    } finally {
      button.disabled = false;
    }
  });

  settingsForm.addEventListener('input', (event) => {
    if (event.target.name) state.settings[event.target.name] = event.target.value;
  });

  textList.addEventListener('input', (event) => {
    const row = event.target.closest('.text-row');
    const language = event.target.dataset.language;
    if (!row || !language) return;
    state.texts[row.dataset.key] ||= { ...textDefaults.get(row.dataset.key) };
    state.texts[row.dataset.key][language] = event.target.value;
  });

  document.getElementById('textSearch').addEventListener('input', renderTexts);

  menuList.addEventListener('input', (event) => {
    const index = Number(event.target.dataset.index);
    const field = event.target.dataset.field;
    if (!field || !state.menu[index]) return;
    state.menu[index][field] = field === 'price' ? Number(event.target.value) : event.target.value;
    const summary = event.target.closest('.menu-editor')?.querySelector('summary span');
    if (field === 'nameAr' && summary) summary.textContent = event.target.value || state.menu[index].nameEn;
  });

  menuList.addEventListener('change', (event) => {
    const index = Number(event.target.dataset.index);
    const field = event.target.dataset.field;
    if (field && state.menu[index]) {
      state.menu[index][field] = field === 'price' ? Number(event.target.value) : event.target.value;
    }
  });

  menuList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-index]');
    if (!button) return;
    state.menu.splice(Number(button.dataset.deleteIndex), 1);
    renderMenu();
  });

  document.getElementById('addMenuItem').addEventListener('click', () => {
    const id = globalThis.crypto?.randomUUID?.() || `menu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.menu.push({
      id, category: 'burgers', nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '',
      price: 0, priceSuffix: '', image: 'menu_burger.png', badgeEn: '', badgeAr: '',
      badgeStyle: '', metaIcon: '', metaEn: '', metaAr: '',
    });
    renderMenu();
    menuList.lastElementChild?.setAttribute('open', '');
    menuList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.getElementById('saveButton').addEventListener('click', async () => {
    saveStatus.textContent = 'جارٍ الحفظ...';
    try {
      await request('/api/admin/data', { method: 'PUT', body: JSON.stringify(state) });
      saveStatus.textContent = 'تم حفظ التغييرات.';
      window.setTimeout(() => { saveStatus.textContent = ''; }, 4000);
    } catch (error) {
      showError(saveStatus, error);
    }
  });

  document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
      await request('/api/admin/logout', { method: 'POST', body: '{}' });
      window.location.reload();
    } catch (error) {
      showError(saveStatus, error);
    }
  });

  document.querySelectorAll('[data-tab-target]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab));
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === tab.dataset.tabTarget));
    });
  });

  showDashboard().catch((error) => {
    if (!error.message.includes('sign in again')) showError(loginNotice, error);
  });
})();
