const express = require('express');
const cors = require('cors');
const https = require('https');
const crypto = require('crypto');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// ✅ Firma corregida según documentación oficial AliExpress Open Platform
function sign(appSecret, params) {
  // 1. Ordenar parámetros alfabéticamente por clave
  const sortedKeys = Object.keys(params).sort();
  // 2. Concatenar: clave + valor (sin separadores entre pares)
  const concatenated = sortedKeys.map(k => `${k}${params[k]}`).join('');
  // 3. Envolver con appSecret al inicio Y al final
  const strToSign = appSecret + concatenated + appSecret;
  // 4. HMAC-SHA256 en MAYÚSCULAS
  return crypto
    .createHmac('sha256', appSecret)
    .update(strToSign, 'utf8')
    .digest('hex')
    .toUpperCase();
}

// ✅ Timestamp en formato UTC requerido por AliExpress: "YYYY-MM-DD HH:mm:ss"
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
    // Construir parámetros base SIN la firma primero
    const baseParams = {
      app_key: appKey,
      format: 'json',
      method: method,
      sign_method: 'hmac-sha256',
      timestamp: getTimestamp(),
      v: '2.0',
      ...params
    };

    // Generar firma con todos los parámetros (excepto sign mismo)
    baseParams.sign = sign(appSecret, baseParams);

    // Construir body URL-encoded
    const body = Object.keys(baseParams)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(baseParams[k])}`)
      .join('&');

    console.log('🔍 Método:', method);
    console.log('🔍 Timestamp:', baseParams.timestamp);
    console.log('🔍 Sign generado:', baseParams.sign);
    console.log('🔍 Body (primeros 300 chars):', body.substring(0, 300));

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
        console.log('📦 AliExpress RAW response (primeros 500 chars):', data.substring(0, 500));
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(new Error('No se pudo parsear respuesta: ' + data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Fallback por si AliExpress falla
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
        const data = await aliRequest(
          'aliexpress.affiliate.hotproduct.query',
          {
            country: 'CO',
            fields: 'product_id,product_title,sale_price,product_main_image_url,product_detail_url,evaluate_rate,30day_orders',
            keywords: 'fashion',
            page_no: '1',
            page_size: '12',
            sort: 'LAST_VOLUME_DESC',
            target_currency: 'USD',
            target_language: 'ES',
            tracking_id: 'default'
          },
          appKey,
          appSecret
        );

        console.log('✅ Respuesta parseada:', JSON.stringify(data).substring(0, 500));

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
            search_url: {
              aliexpress: item.product_detail_url ||
                `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(item.product_title || '')}`
            }
          }));
        } else {
          console.log('⚠️ AliExpress respondió OK pero sin productos. Usando fallback.');
        }

      } catch(e) {
        console.log('❌ Error llamando AliExpress API:', e.message);
      }
    } else {
      console.log('⚠️ Variables de entorno no encontradas. Usando fallback.');
    }

    // Si no hay productos reales, usar fallback
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
      source: products[0]?.source
    });

  } catch (error) {
    console.log('💥 Error general:', error.message);
    res.status(500).json({ error: 'Error interno', detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
