import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('../.tmp/stomatologiya-check');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
const failed = [];
const notFound = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => failed.push(`${request.url()} :: ${request.failure()?.errorText}`));
page.on('response', response => { if (response.status() === 404) notFound.push(response.url()); });
const checks = [];
function check(name, condition, details = '') {
  checks.push({ name, ok: Boolean(condition), details });
  if (!condition) console.error('FAIL', name, details);
}

await page.goto('http://127.0.0.1:7100/', { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await page.locator('#discount-dialog[open]').waitFor({ timeout: 15000 });
check('Окно скидки открывается автоматически', await page.locator('#discount-dialog').isVisible());
await page.screenshot({ path: path.join(out, 'discount-desktop.jpg'), type: 'jpeg', quality: 86 });
await page.locator('#discount-close').click();
check('Окно скидки закрывается кнопкой', !(await page.locator('#discount-dialog').isVisible()));

await page.locator('#quick-form button[type="submit"]').click();
check('Короткая форма показывает ошибку', await page.locator('#quick-error').isVisible());
await page.locator('#quick-name').fill('Андрей');
await page.locator('#quick-phone').fill('+7 900 123-45-67');
await page.locator('#quick-consent').check();
await page.locator('#quick-form button[type="submit"]').click();
check('Короткая форма показывает результат', await page.locator('#quick-success').isVisible());
const quickSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('liniya-demo-quick-v1') || 'null'));
check('Короткая заявка сохраняется локально', quickSaved?.name === 'Андрей' && quickSaved?.phone === '+7 900 123-45-67');
await page.locator('#quick-edit').click();
check('Короткую заявку можно изменить', await page.locator('#quick-form').isVisible() && await page.locator('#quick-name').inputValue() === 'Андрей');

await page.locator('[data-open-discount]').click();
check('Плашка повторно открывает окно', await page.locator('#discount-dialog').isVisible());
await page.keyboard.press('Escape');
check('Окно скидки закрывается по Escape', !(await page.locator('#discount-dialog').isVisible()));
await page.locator('[data-open-discount]').click();
await page.locator('#discount-book').click();
check('Переход из акции заполняет форму', (await page.locator('#booking-comment').inputValue()).includes('скидкой 10 %') && await page.locator('#booking-service').inputValue() === 'Пока не знаю — нужна консультация');
await page.goto('http://127.0.0.1:7100/', { waitUntil: 'networkidle' });
check('Первый экран содержит зафиксированный оффер', (await page.locator('h1').textContent()).replace(/\s+/g, ' ').includes('Лечение зубов с понятным бюджетом: три сценария и рассрочка без процентов'));
const motion = await page.evaluate(() => ({ entrance: getComputedStyle(document.querySelector('.hero-title-line')).animationName, photo: getComputedStyle(document.querySelector('.hero-photo')).animationName }));
check('Анимация первого экрана включена', motion.entrance === 'hero-enter' && motion.photo === 'hero-photo-enter', JSON.stringify(motion));
check('Все иконки отрисованы', await page.locator('i[data-lucide]').count() === 0);
check('На странице шесть услуг', await page.locator('.service-card').count() === 6);
await page.locator('#smile-range').focus();
await page.locator('#smile-range').press('End');
check('Ползунок улыбки работает с клавиатуры', await page.locator('#smile-compare').evaluate(element => element.style.getPropertyValue('--position')) === '90%');
await page.locator('#smile-range').press('Home');
check('Ползунок возвращается к началу', await page.locator('#smile-compare').evaluate(element => element.style.getPropertyValue('--position')) === '10%');
await page.locator('#smile').screenshot({ path: path.join(out, 'smile-comparison.jpg'), type: 'jpeg', quality: 86 });
const sectionOrder = await page.evaluate(() => {
  const sections = Array.from(document.querySelector('main').children);
  return { smile: sections.indexOf(document.querySelector('#smile')), services: sections.indexOf(document.querySelector('#services')), equipment: sections.indexOf(document.querySelector('#equipment')), gallery: sections.indexOf(document.querySelector('.gallery-section')), doctors: sections.indexOf(document.querySelector('#doctors')) };
});
check('Улыбка находится выше услуг', sectionOrder.smile < sectionOrder.services);
check('Врачи перенесены ниже галереи и оборудования', sectionOrder.doctors > sectionOrder.equipment && sectionOrder.doctors > sectionOrder.gallery);
check('Доступны три сценария лечения', await page.locator('.scenario-tab').count() === 3);
await page.locator('[data-scenario="stages"]').click();
check('Переключение сценария меняет содержание', (await page.locator('#scenario-title').textContent()).includes('Распределить') && await page.locator('[data-scenario="stages"]').getAttribute('aria-selected') === 'true');
await page.locator('[data-scenario="stages"]').press('ArrowRight');
check('Сценарии управляются с клавиатуры', await page.locator('[data-scenario="complete"]').getAttribute('aria-selected') === 'true' && (await page.locator('#scenario-price').textContent()).includes('36 000'));
await page.locator('[data-scenario="priority"]').click();
for (const image of await page.locator('main img').all()) await image.scrollIntoViewIfNeeded();
await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: path.join(out, 'desktop-hero.jpg'), type: 'jpeg', quality: 86 });
await page.screenshot({ path: path.join(out, 'desktop-full.jpg'), fullPage: true, type: 'jpeg', quality: 78 });

await page.locator('[data-service="Лечение зубов"]').click();
check('Выбор услуги подставляет её в форму', await page.locator('#booking-service').inputValue() === 'Лечение зубов');
await page.locator('#booking-form button[type="submit"]').click();
check('Пустая форма показывает ошибку', await page.locator('#booking-error').isVisible());
await page.locator('#booking-name').fill('Андрей');
await page.locator('#booking-phone').fill('+7 900 123-45-67');
const desiredDate = new Date(); desiredDate.setDate(desiredDate.getDate() + 3);
const dateValue = `${desiredDate.getFullYear()}-${String(desiredDate.getMonth() + 1).padStart(2, '0')}-${String(desiredDate.getDate()).padStart(2, '0')}`;
await page.locator('#booking-date').fill(dateValue);
await page.locator('#booking-time').selectOption({ label: 'День' });
await page.locator('#booking-comment').fill('Нужна консультация');
await page.locator('#booking-consent').check();
await page.locator('#booking-form button[type="submit"]').click();
check('Валидная форма показывает результат', await page.locator('#booking-success').isVisible());
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('liniya-demo-booking-v1') || 'null'));
check('Заявка сохраняется локально со всеми полями', saved?.name === 'Андрей' && saved?.service === 'Лечение зубов' && saved?.date === dateValue && saved?.time === 'День');
check('Текст заявки содержит данные и пометку демо', (await page.locator('#booking-result').inputValue()).includes('Андрей') && (await page.locator('#booking-result').inputValue()).includes('не отправлена клинике'));
await page.locator('#copy-booking').click();
check('Копирование заявки работает', (await page.evaluate(() => navigator.clipboard.readText())).includes('Андрей'));
check('Уведомление о копировании видно', await page.locator('#toast').isVisible());
await page.screenshot({ path: path.join(out, 'booking-success.jpg'), type: 'jpeg', quality: 84 });
await page.locator('#edit-booking').click();
check('Можно вернуться к редактированию', await page.locator('#booking-form').isVisible() && await page.locator('#booking-name').inputValue() === 'Андрей');

for (const href of ['#services', '#scenarios', '#doctors', '#about', '#contacts']) {
  await page.locator(`.desktop-nav a[href="${href}"]`).click();
  await page.waitForTimeout(250);
  check(`Навигация ${href} работает`, await page.evaluate(id => location.hash === id, href));
}
await page.locator('.faq-list details').first().locator('summary').click();
check('FAQ раскрывается', await page.locator('.faq-list details').first().getAttribute('open') !== null);

const widths = {};
for (const width of [360, 375, 390, 430, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('http://127.0.0.1:7100/', { waitUntil: 'networkidle' });
  widths[width] = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  check(`Нет горизонтальной прокрутки на ${width}px`, widths[width].scroll <= widths[width].client, JSON.stringify(widths[width]));
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:7100/', { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(out, 'mobile-hero.jpg'), type: 'jpeg', quality: 86 });
await page.locator('#menu-toggle').click();
check('Мобильное меню открывается', await page.locator('#mobile-menu').isVisible());
await page.locator('#mobile-menu a[href="#services"]').click();
check('Мобильное меню закрывается после перехода', !(await page.locator('#mobile-menu').isVisible()));
for (const image of await page.locator('main img').all()) await image.scrollIntoViewIfNeeded();
await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: path.join(out, 'mobile-full.jpg'), fullPage: true, type: 'jpeg', quality: 78 });
await page.locator('.mobile-booking').click();
await page.waitForFunction(() => {
  const rect = document.querySelector('#booking').getBoundingClientRect();
  return rect.top >= 0 && rect.top < 140;
});
await page.screenshot({ path: path.join(out, 'mobile-booking.jpg'), type: 'jpeg', quality: 84 });
check('Мобильная кнопка ведёт к форме', await page.evaluate(() => location.hash === '#booking'));
await page.locator('[data-open-discount]').click();
check('Окно скидки работает на мобильном', await page.locator('#discount-dialog').isVisible());
await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#discount-dialog')).opacity) > .99);
await page.screenshot({ path: path.join(out, 'discount-mobile.jpg'), type: 'jpeg', quality: 86 });
await page.locator('#discount-close').click();

const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(item => ({ name: item.name, bytes: item.transferSize })));
const localBytes = resources.filter(item => item.name.startsWith('http://127.0.0.1')).reduce((sum, item) => sum + item.bytes, 0);
check('Нет ошибок консоли', errors.length === 0, errors.join('\n'));
check('Нет HTTP 404', notFound.length === 0, notFound.join('\n'));
check('Нет неудачных запросов', failed.length === 0, failed.join('\n'));
const report = { checks, errors, failed, notFound, requests: resources.length, localBytes };
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: checks.filter(item => item.ok).length, failed: checks.filter(item => !item.ok).length, errors, requestFailures: failed, notFound, requests: resources.length, localBytes }, null, 2));
await browser.close();
process.exit(checks.some(item => !item.ok) ? 1 : 0);
