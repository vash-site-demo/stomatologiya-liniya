// Интерактивность демо-лендинга: меню, выбор услуги, проверка и локальное сохранение заявки.
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const STORAGE_KEY = 'liniya-demo-booking-v1';

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

const menuButton = $('#menu-toggle');
const mobileMenu = $('#mobile-menu');

function closeMenu() {
  mobileMenu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Открыть меню');
  document.body.classList.remove('menu-open');
}

menuButton.addEventListener('click', () => {
  const willOpen = mobileMenu.hidden;
  mobileMenu.hidden = !willOpen;
  menuButton.setAttribute('aria-expanded', String(willOpen));
  menuButton.setAttribute('aria-label', willOpen ? 'Закрыть меню' : 'Открыть меню');
  document.body.classList.toggle('menu-open', willOpen);
});

$$('#mobile-menu a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !mobileMenu.hidden) closeMenu();
});

window.addEventListener('scroll', () => {
  $('.site-header').classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// Выбор услуги переносит её в форму, чтобы посетителю не пришлось вводить направление повторно.
$$('[data-service]').forEach((button) => {
  button.addEventListener('click', () => {
    $('#booking-service').value = button.dataset.service;
    $('#booking').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    window.setTimeout(() => $('#booking-name').focus({ preventScroll: true }), 450);
  });
});

// Переключатель показывает, как врач может представить разные сценарии одного плана.
const scenarios = {
  priority: {
    overline: 'Сценарий 01 · первый этап',
    title: 'Сначала устранить причину беспокойства',
    description: 'Врач определяет приоритетную зону и отделяет срочное лечение от процедур, которые можно запланировать позже.',
    features: ['Приоритетная зона и диагностика', 'Необходимые процедуры первого этапа', 'Что можно перенести без ущерба по показаниям'],
    price: '12 000 ₽'
  },
  stages: {
    overline: 'Сценарий 02 · несколько этапов',
    title: 'Распределить лечение и расходы по времени',
    description: 'План разбивается на последовательные этапы. Перед каждым видно объём работ, стоимость и место этапа в общем лечении.',
    features: ['Последовательность клинически допустимых этапов', 'Отдельная смета для каждого этапа', 'Ориентиры по срокам и визитам'],
    price: '7 500 ₽ / этап'
  },
  complete: {
    overline: 'Сценарий 03 · полный план',
    title: 'Увидеть весь объём лечения и итоговый бюджет',
    description: 'Все согласованные процедуры собраны в одном плане. Можно оценить полную стоимость и обсудить доступные условия оплаты.',
    features: ['Полный перечень согласованных процедур', 'Итоговая смета и последовательность визитов', 'Условия рассрочки до оформления'],
    price: '36 000 ₽'
  }
};

const scenarioTabs = $$('.scenario-tab');
const scenarioPanel = $('#scenario-panel');

function selectScenario(key, moveFocus = false) {
  const scenario = scenarios[key];
  if (!scenario) return;
  scenarioTabs.forEach((tab) => {
    const selected = tab.dataset.scenario === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) {
      scenarioPanel.setAttribute('aria-labelledby', tab.id);
      if (moveFocus) tab.focus();
    }
  });
  $('#scenario-overline').textContent = scenario.overline;
  $('#scenario-title').textContent = scenario.title;
  $('#scenario-description').textContent = scenario.description;
  $('#scenario-price').textContent = scenario.price;
  $('#scenario-features').innerHTML = scenario.features.map((feature) => `<li><i data-lucide="check" aria-hidden="true"></i>${feature}</li>`).join('');
  refreshIcons();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scenarioPanel.animate(
      [{ opacity: 0.45, transform: 'translateY(8px) scale(.99)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }],
      { duration: 220, easing: 'ease-out' }
    );
  }
}

scenarioTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectScenario(tab.dataset.scenario));
  tab.addEventListener('keydown', (event) => {
    let nextIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % scenarioTabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + scenarioTabs.length) % scenarioTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = scenarioTabs.length - 1;
    else return;
    event.preventDefault();
    selectScenario(scenarioTabs[nextIndex].dataset.scenario, true);
  });
});

// Акция использует нативный диалог: фокус остаётся внутри окна, Esc работает автоматически.
const discountDialog = $('#discount-dialog');
const DISCOUNT_SESSION_KEY = 'liniya-discount-seen-v1';

function openDiscount() {
  if (discountDialog.open) return;
  discountDialog.showModal();
  document.body.classList.add('dialog-open');
  try {
    sessionStorage.setItem(DISCOUNT_SESSION_KEY, '1');
  } catch (storageError) {
    // Если хранилище недоступно, окно всё равно должно открываться по кнопке.
  }
}

$$('[data-open-discount]').forEach((button) => button.addEventListener('click', openDiscount));
$('#discount-close').addEventListener('click', () => discountDialog.close());
discountDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
discountDialog.addEventListener('click', (event) => {
  const rect = discountDialog.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) discountDialog.close();
});

$('#discount-book').addEventListener('click', () => {
  discountDialog.close();
  $('#booking-success').hidden = true;
  $('#booking-form').hidden = false;
  $('#booking-service').value = 'Пока не знаю — нужна консультация';
  const comment = $('#booking-comment');
  const discountNote = 'Хочу записаться на первичный приём со скидкой 10 %.';
  if (!comment.value.includes(discountNote)) comment.value = `${comment.value.trim()} ${discountNote}`.trim();
  $('#booking').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  window.setTimeout(() => $('#booking-name').focus({ preventScroll: true }), 450);
});

// Автопоказ один раз за сессию, но не во время заполнения формы.
let discountSeen = false;
try {
  discountSeen = sessionStorage.getItem(DISCOUNT_SESSION_KEY) === '1';
} catch (storageError) {
  discountSeen = false;
}
window.setTimeout(() => {
  const activeTag = document.activeElement?.tagName;
  if (!discountSeen && !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) openDiscount();
}, 8000);

// Короткая форма работает локально: проверяет поля и не имитирует отправку администратору.
$('#quick-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = {
    name: $('#quick-name').value.trim(),
    phone: $('#quick-phone').value.trim(),
    createdAt: new Date().toISOString()
  };
  let error = '';
  if (data.name.length < 2) error = 'Укажите имя — минимум два символа.';
  else if (data.phone.replace(/\D/g, '').length < 10) error = 'Укажите телефон с кодом города или оператора.';
  else if (!$('#quick-consent').checked) error = 'Подтвердите согласие на локальное сохранение демо-заявки.';

  const errorElement = $('#quick-error');
  errorElement.textContent = error;
  errorElement.hidden = !error;
  if (error) return;

  try {
    localStorage.setItem('liniya-demo-quick-v1', JSON.stringify(data));
  } catch (storageError) {
    errorElement.textContent = 'Браузер не разрешил сохранить заявку. Проверьте настройки хранилища.';
    errorElement.hidden = false;
    return;
  }
  $('#quick-form').hidden = true;
  $('#quick-success').hidden = false;
  $('#quick-edit').focus();
});

$('#quick-edit').addEventListener('click', () => {
  $('#quick-success').hidden = true;
  $('#quick-form').hidden = false;
  $('#quick-name').focus();
});

const bookingDate = $('#booking-date');
bookingDate.min = localDate(new Date());

function bookingText(data) {
  return `Демо-заявка на приём в стоматологию «Линия»\n\nИмя: ${data.name}\nТелефон: ${data.phone}\nУслуга: ${data.service}\nЖелаемая дата: ${formatDate(data.date)}\nУдобное время: ${data.time}\nКомментарий: ${data.comment || 'нет'}\n\nЗаявка создана в демонстрационном сайте и не отправлена клинике.`;
}

$('#booking-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = {
    name: $('#booking-name').value.trim(),
    phone: $('#booking-phone').value.trim(),
    service: $('#booking-service').value,
    date: bookingDate.value,
    time: $('#booking-time').value,
    comment: $('#booking-comment').value.trim()
  };
  let error = '';
  if (data.name.length < 2) error = 'Укажите имя — минимум два символа.';
  else if (data.phone.replace(/\D/g, '').length < 10) error = 'Укажите телефон с кодом города или оператора.';
  else if (!data.service) error = 'Выберите услугу или консультацию.';
  else if (!data.date) error = 'Выберите желаемую дату.';
  else if (data.date < localDate(new Date())) error = 'Дата не может быть в прошлом.';
  else if (!$('#booking-consent').checked) error = 'Подтвердите согласие на локальное сохранение демо-заявки.';

  const errorElement = $('#booking-error');
  errorElement.textContent = error;
  errorElement.hidden = !error;
  if (error) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, createdAt: new Date().toISOString() }));
  } catch (storageError) {
    errorElement.textContent = 'Браузер не разрешил сохранить заявку. Проверьте настройки хранилища.';
    errorElement.hidden = false;
    return;
  }

  $('#booking-result').value = bookingText(data);
  $('#booking-form').hidden = true;
  $('#booking-success').hidden = false;
  refreshIcons();
  $('#copy-booking').focus();
});

$('#edit-booking').addEventListener('click', () => {
  $('#booking-success').hidden = true;
  $('#booking-form').hidden = false;
  $('#booking-name').focus();
});

let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  // Popover показывает уведомление поверх остального интерфейса.
  if (typeof toast.showPopover === 'function' && !toast.matches(':popover-open')) toast.showPopover();
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (typeof toast.hidePopover === 'function' && toast.matches(':popover-open')) toast.hidePopover();
    toast.hidden = true;
  }, 2400);
}

$('#copy-booking').addEventListener('click', async () => {
  const result = $('#booking-result');
  try {
    await navigator.clipboard.writeText(result.value);
    showToast('Текст заявки скопирован');
  } catch (error) {
    result.focus();
    result.select();
    const copied = document.execCommand('copy');
    showToast(copied ? 'Текст заявки скопирован' : 'Выделите текст и скопируйте вручную');
  }
});

// Ползунок меняет границу сравнения и работает мышью, касанием и клавиатурой.
$('#smile-range').addEventListener('input', (event) => {
  $('#smile-compare').style.setProperty('--position', `${event.target.value}%`);
});

refreshIcons();
