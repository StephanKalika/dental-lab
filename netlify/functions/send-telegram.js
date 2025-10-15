// Netlify Function: send-telegram
// Securely forwards booking form data to Telegram without exposing bot token to the client

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

    const { name, phone, email, service, date, comment } = body || {};
    if (!name || !phone) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Missing required fields' }) };
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

    const message = `\n🦷 <b>Нова заявка з сайту Dental Lab</b>\n\n👤 <b>Ім'я:</b> ${name}\n📞 <b>Телефон:</b> ${phone}\n${email ? `📧 <b>Email:</b> ${email}` : ''}\n🏥 <b>Послуга:</b> ${service ? (serviceNames[service] || service) : 'Не вказано'}\n📅 <b>Бажана дата:</b> ${formattedDate}\n${comment ? `💬 <b>Коментар:</b> ${comment}` : ''}`.trim();

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
