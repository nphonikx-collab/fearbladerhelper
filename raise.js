/**
 * FunPay Auto-Raise — GitHub Actions Script
 * 
 * Секреты (Settings → Secrets → Actions → New repository secret):
 *   GOLDEN_KEY  — твой golden_key с FunPay (из куки браузера)
 *   NODE_IDS    — Node ID категорий через запятую, напр: 436,628
 *   TG_TOKEN    — токен Telegram бота (опционально)
 *   TG_CHAT_ID  — chat_id куда слать уведомления (опционально)
 */

const https = require('https');

const GOLDEN_KEY = process.env.GOLDEN_KEY;
const NODE_IDS   = (process.env.NODE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const TG_TOKEN   = process.env.TG_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

if (!GOLDEN_KEY) { console.error('❌ GOLDEN_KEY не задан'); process.exit(1); }
if (!NODE_IDS.length) { console.error('❌ NODE_IDS не задан'); process.exit(1); }

// ── HTTP запрос ──
function req(path, opts = {}) {
  return new Promise((resolve, reject) => {
    let cookieStr = `golden_key=${GOLDEN_KEY}`;
    if (opts.extraCookie) cookieStr += ';' + opts.extraCookie;

    const options = {
      hostname: 'funpay.com',
      path,
      method: opts.method || 'GET',
      headers: {
        'Cookie': cookieStr,
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        ...(opts.headers || {}),
      }
    };

    const r = https.request(options, res => {
      let data = '';
      const rawCookies = res.headers['set-cookie'] || [];
      const cookies = rawCookies.map(c => c.split(';')[0]).join(';');
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data, cookies }));
    });
    r.on('error', reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

// ── Извлечь CSRF токен ──
function getCsrf(html) {
  const patterns = [
    /data-csrf-token=["']([^"']+)["']/,
    /name=["']csrf_token["'][^>]*value=["']([^"']+)["']/,
    /value=["']([^"']+)["'][^>]*name=["']csrf_token["']/,
    /"csrf_token"\s*:\s*"([^"]+)"/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

// ── Поднять один node ──
async function raiseNode(nodeId) {
  console.log(`\n▶ Поднимаю node=${nodeId}...`);

  // Шаг 1: trade page → CSRF + session cookies
  const tradeResp = await req(`/lots/${nodeId}/trade`);
  if (tradeResp.status !== 200) {
    console.error(`  ❌ trade HTTP ${tradeResp.status}`);
    return false;
  }
  const csrf = getCsrf(tradeResp.body);
  if (!csrf) {
    console.error('  ❌ CSRF не найден');
    return false;
  }
  console.log(`  ✓ CSRF: ...${csrf.slice(-8)}`);

  // Шаг 2: кнопка «Поднять предложения» → /lots/raise
  const doc = tradeResp.body;
  const raiseBtn = doc.match(/class="[^"]*js-lot-raise[^"]*"[^>]*data-game="(\d+)"[^>]*data-node="(\d+)"/);
  const gameId = raiseBtn ? raiseBtn[1] : nodeId;
  const nodeRaise = raiseBtn ? raiseBtn[2] : nodeId;

  const body = new URLSearchParams({
    game_id: gameId,
    node_id: nodeRaise,
    csrf_token: csrf,
  }).toString();

  const raiseResp = await req('/lots/raise', {
    method: 'POST',
    extraCookie: tradeResp.cookies,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `https://funpay.com/lots/${nodeId}/trade`,
      'Origin': 'https://funpay.com',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
    body,
  });

  console.log(`  Raise HTTP ${raiseResp.status}: ${raiseResp.body.slice(0, 100)}`);
  return raiseResp.status === 200;
}

// ── Telegram уведомление ──
async function tgSend(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;
  const body = JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true });
  return new Promise(resolve => {
    const r = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => { let d=''; res.on('data', c=>d+=c); res.on('end', ()=>resolve(JSON.parse(d))); });
    r.on('error', resolve);
    r.write(body);
    r.end();
  });
}

// ── Главная функция ──
async function main() {
  console.log(`\n🚀 FunPay Auto-Raise | ${new Date().toLocaleString('ru')}`);
  console.log(`📂 Категории: ${NODE_IDS.join(', ')}\n`);

  let ok = 0;
  for (const nodeId of NODE_IDS) {
    const result = await raiseNode(nodeId);
    if (result) ok++;
    // Небольшая пауза между запросами
    await new Promise(r => setTimeout(r, 1500));
  }

  const msg = ok > 0
    ? `✅ Поднято ${ok}/${NODE_IDS.length}`
    : `❌ Ошибка поднятия (${NODE_IDS.length - ok}/${NODE_IDS.length})`;

  console.log(`\n${msg}`);

  // TG уведомление
  if (TG_TOKEN && TG_CHAT_ID) {
    await tgSend(
      `⬆️ <b>Лоты подняты!</b>\n`
    + `📂 Категории: <code>${NODE_IDS.join(', ')}</code>\n`
    + `⏱ Следующее поднятие через: <b>04:00:01</b>\n`
    + `✅ Успешно: ${ok}/${NODE_IDS.length}`
    );
    console.log('📬 TG уведомление отправлено');
  }

  process.exit(ok > 0 ? 0 : 1);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
