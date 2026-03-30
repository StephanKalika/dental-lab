// Netlify Function: send-telegram
// Securely forwards booking form data to Telegram without exposing bot token to the client

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateStore = new Map();

function getClientIp(event) {
  const xff = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'] || '';
  return xff.split(',')[0].trim() || 'unknown';
}

function isRateLimited(key) {
  const now = Date.now();
  const history = rateStore.get(key) || [];
  const recent = history.filter((ts) => now - ts < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateStore.set(key, recent);
    return true;
  }
  recent.push(now);
  rateStore.set(key, recent);
  return false;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigins = new Set([
    'https://dental-lab.site',
    'https://www.dental-lab.site',
    'https://dentalab.netlify.app',
  ]);
  const allowOrigin = allowedOrigins.has(origin) ? origin : 'https://dental-lab.site';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
  const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders };
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    if (!contentType.includes('application/json')) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Invalid content type' }) };
    }

    const body = JSON.parse(event.body || '{}');

    // basic honeypot / spam check
    if (body.website) {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
    }

    const { name, phone, service, date, comment } = body || {};
    if (!name || !phone) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const normalizedPhone = String(phone).replace(/\D/g, '');
    if (!/^380\d{9}$/.test(normalizedPhone)) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Invalid phone number' }) };
    }

    const clientIp = getClientIp(event);
    const rateKey = `${clientIp}:${normalizedPhone}`;
    if (isRateLimited(rateKey)) {
      return { statusCode: 429, headers: jsonHeaders, body: JSON.stringify({ error: 'Too many requests' }) };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    const serviceNames = {
      consultation: 'Консультація стоматолога',
      hygiene: 'Професійна гігієна',
      treatment: 'Лікування карієсу',
      whitening: 'Відбілювання зубів',
      prosthetics: 'Протезування',
      implantation: 'Імплантація',
      orthodontics: 'Ортодонтія',
      surgery: 'Хірургічна стоматологія',
    };

    let formattedDate = 'Не вказано';
    if (date) {
      const dateObj = new Date(date);
      formattedDate = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    }

    const safeName = escapeHtml(name);
    const safePhone = escapeHtml(phone);
    const safeService = escapeHtml(service ? (serviceNames[service] || service) : 'Не вказано');
    const safeDate = escapeHtml(formattedDate);
    const safeComment = escapeHtml(comment || '');

    const message = `\n🦷 <b>Нова заявка з сайту Dental Lab</b>\n\n👤 <b>Ім'я:</b> ${safeName}\n📞 <b>Телефон:</b> ${safePhone}\n🏥 <b>Послуга:</b> ${safeService}\n📅 <b>Бажана дата:</b> ${safeDate}\n${safeComment ? `💬 <b>Коментар:</b> ${safeComment}` : ''}`.trim();

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });

    if (!tgRes.ok) {
      const text = await tgRes.text();
      return { statusCode: 502, headers: jsonHeaders, body: JSON.stringify({ error: 'Telegram error', details: text }) };
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Unexpected error', details: String(err) }) };
  }
};
