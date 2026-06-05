const express = require('express');
const cors = require('cors');
const https = require('https');
const crypto = require('crypto');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// ✅ Firma AliExpress - Método verificado (method2)
function sign(appSecret, params) {
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'sign' && params[k] !== undefined && params[k] !== '')
    .sort();
  
  const strToSign = sortedKeys.map(k => `${k}${params[k]}`).join('');
  
  return crypto
    .createHmac('sha256', appSecret)
    .update(strToSign, 'utf8')
    .digest('hex')
    .toUpperCase();
}

function getTimestamp() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function aliRequest(method, params, appKey, appSecret) {
  return new Promise((resolve, reject) => {
    const baseParams = {
      app_key: appKey,
      format: 'json',
      method: method,
      sign_method: 'hmac-sha256',
      timestamp: getTimestamp(),
      v: '2.0',
      ...params
    };

    baseParams.sign = sign(appSecret, baseParams);

    const sortedKeys = Object.keys(baseParams).sort();
    const body = sortedKeys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(baseParams[k])}`)
      .join('&');

    const options = {
      hostname: 'api-sg.aliexpress.com',
      path: '/sync',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(new Error('Parse error: ' + data.substring(0, 200)));
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ✅ Keywords aleatorias para variedad de productos
const KEYWORDS = [
  'fashion', 'jewelry', 'watches', 'bags', 'shoes',
  'home decor', 'kitchen gadgets', 'electronics', 'sports', 'beauty',
  'toys', 'phone accessories', 'smart gadgets', 'fitness', 'pet supplies',
  'baby products', 'automotive', 'garden tools', 'office supplies', 'outdoor'
];

// ✅ Sorts aleatorios para más variedad
const SORTS = [
  'LAST_VOLUME_DESC',
  'SALE_PRICE_ASC',
  'SALE_PRICE_DESC',
  'EVALUATE_SCORE_DESC'
];

const FALLBACK_PRODUCTS = [
  { keyword: 'audifonos bluetooth inalambricos', traffic: '100K+' },
  { keyword: 'smartwatch deportivo mujer', traffic: '80K+' },
  { keyword: 'crema facial coreana hidratante', traffic: '95K+' },
  { keyword: 'tenis deportivos mujer 2025', traffic: '150K+' },
  { keyword: 'bolso cuero sintetico mujer', traffic: '90K+' },
  { keyword: 'lampara led escritorio usb', traffic: '40K+' },
  { keyword: 'set maquillaje profesional', traffic: '120K+' },
  { keyword: 'funda celular samsung transparente', traffic: '200K+' },
  { keyword: 'organizador cocina modular', traffic: '60K+' },
  { keyword: 'collar mascotas personalizado', traffic: '35K+' },
  { keyword: 'kit fitness bandas resistencia', traffic: '75K+' },
  { keyword: 'vestido mujer elegante casual', traffic: '180K+' },
];

app.post('/api/trenddropi/generate', async (req, res) => {
  try {
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    console.log('🔑 APP_KEY present:', !!appKey, '| APP_SECRET present:', !!appSecret);

    let products = [];

    if (appKey && appSecret) {
      try {
        // Seleccionar keyword y sort aleatorios
        const randomKeyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
        const randomSort = SORTS[Math.floor(Math.random() * SORTS.length)];
        
        console.log('🔑 Keyword aleatoria:', randomKeyword);
        console.log('🎲 Sort aleatorio:', randomSort);

        const data = await aliRequest(
          'aliexpress.affiliate.hotproduct.query',
          {
            country: 'CO',
            fields: 'product_id,product_title,sale_price,product_main_image_url,product_detail_url,evaluate_rate,30day_orders',
            keywords: randomKeyword,
            page_no: '1',
            page_size: '12',
            sort: randomSort,
            target_currency: 'USD',
            target_language: 'ES',
            tracking_id: 'default'
          },
          appKey,
          appSecret
        );

        const items =
          data?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result?.products?.product || [];

        console.log('📋 Productos encontrados:', items.length);

        if (items.length > 0) {
          products = items.map((item, index) => ({
            id: index + 1,
            name: item.product_title?.substring(0, 60) || 'Producto AliExpress',
            trend_score: Math.max(70, 99 - index * 2),
            traffic: item['30day_orders'] ? `${item['30day_orders']} vendidos` : '50K+',
            price: item.sale_price,
            image: item.product_main_image_url,
            source: 'AliExpress Hot Products',
            category: randomKeyword,
            search_url: {
              aliexpress: item.product_detail_url ||
                `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(item.product_title || '')}`
            }
          }));
        }

      } catch(e) {
        console.log('❌ Error llamando AliExpress API:', e.message);
      }
    }

    if (!products.length) {
      console.log('🔄 Usando lista fallback');
      const shuffled = [...FALLBACK_PRODUCTS].sort(() => Math.random() - 0.5).slice(0, 12);
      products = shuffled.map((item, index) => ({
        id: index + 1,
        name: item.keyword,
        trend_score: Math.max(70, 99 - index * 2),
        traffic: item.traffic,
        source: 'Google Trends Colombia (fallback)',
        search_url: {
          aliexpress: `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(item.keyword)}`
        }
      }));
    }

    res.json({
      success: true,
      products,
      total: products.length,
      source: products[0]?.source,
      category: products[0]?.category || 'fallback'
    });

  } catch (error) {
    console.log('💥 Error general:', error.message);
    res.status(500).json({ error: 'Error interno', detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
