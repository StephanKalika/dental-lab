// Netlify Function: send-telegram
// Securely forwards booking form data to Telegram without exposing bot token to the client

const RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 20);
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
  const allowOrigin = origin || '*';
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
    let body = {};

    if (contentType.includes('application/json')) {
      body = JSON.parse(event.body || '{}');
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const parsed = new URLSearchParams(event.body || '');
      body = Object.fromEntries(parsed.entries());
    } else {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Invalid content type' }) };
    }

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
    const groupChatId = '-5210901120';
    const configuredChatIds = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const chatIds = Array.from(new Set([groupChatId, ...configuredChatIds]));
    if (!token || chatIds.length === 0) {
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

    const sendResults = await Promise.allSettled(
      chatIds.map((chatId) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      }))
    );

    const failedSends = [];
    for (let index = 0; index < sendResults.length; index += 1) {
      const result = sendResults[index];
      if (result.status === 'rejected') {
        failedSends.push({ chatId: chatIds[index], error: String(result.reason) });
        continue;
      }

      if (!result.value.ok) {
        failedSends.push({ chatId: chatIds[index], error: await result.value.text() });
      }
    }

    if (failedSends.length === chatIds.length) {
      return { statusCode: 502, headers: jsonHeaders, body: JSON.stringify({ error: 'Telegram error', details: failedSends }) };
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, failedSends }) };
  } catch (err) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'Unexpected error', details: String(err) }) };
  }
};
