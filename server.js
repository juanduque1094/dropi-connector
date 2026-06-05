const express = require('express');
const cors = require('cors');
const https = require('https');
const crypto = require('crypto');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// ============================================
// MÉTODO 1: Firma estándar AliExpress (appSecret envolviendo)
// ============================================
function signMethod1(appSecret, params) {
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort();
  
  let strToSign = '';
  sortedKeys.forEach(key => {
    strToSign += key + params[key];
  });
  
  strToSign = appSecret + strToSign + appSecret;
  
  return crypto
    .createHmac('sha256', appSecret)
    .update(strToSign, 'utf8')
    .digest('hex')
    .toUpperCase();
}

// ============================================
// MÉTODO 2: Firma alternativa (sin envolver)
// ============================================
function signMethod2(appSecret, params) {
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort();
  
  const strToSign = sortedKeys.map(k => `${k}${params[k]}`).join('');
  
  return crypto
    .createHmac('sha256', appSecret)
    .update(strToSign, 'utf8')
    .digest('hex')
    .toUpperCase();
}

// ============================================
// MÉTODO 3: Firma con key=value&key=value
// ============================================
function signMethod3(appSecret, params) {
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort();
  
  const strToSign = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  
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

function aliRequest(method, params, appKey, appSecret, signMethod = 'method1') {
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

    // Seleccionar método de firma
    let signature;
    if (signMethod === 'method1') {
      signature = signMethod1(appSecret, baseParams);
    } else if (signMethod === 'method2') {
      signature = signMethod2(appSecret, baseParams);
    } else {
      signature = signMethod3(appSecret, baseParams);
    }
    
    baseParams.sign = signature;

    const sortedKeys = Object.keys(baseParams).sort();
    const body = sortedKeys
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(baseParams[k])}`)
      .join('&');

    console.log(`🔐 Usando método: ${signMethod}`);
    console.log(`🔐 Firma generada: ${signature}`);

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
        console.log(`📦 Respuesta (${signMethod}):`, data.substring(0, 500));
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

// ============================================
// ENDPOINT DE DIAGNÓSTICO - Prueba los 3 métodos
// ============================================
app.get('/api/test-signature', async (req, res) => {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  
  console.log('🔍 DIAGNÓSTICO INICIADO');
  console.log(`🔑 App Key: ${appKey}`);
  console.log(`🔑 App Secret (primeros 10 chars): ${appSecret?.substring(0, 10)}...`);
  console.log(`🔑 App Secret (últimos 10 chars): ...${appSecret?.slice(-10)}`);
  
  const results = {};
  
  // Probar los 3 métodos
  for (const method of ['method1', 'method2', 'method3']) {
    try {
      const data = await aliRequest(
        'aliexpress.affiliate.product.query',
        {
          country: 'CO',
          fields: 'product_id,product_title,sale_price',
          keywords: 'fashion',
          page_size: '5',
          target_currency: 'USD',
          target_language: 'ES'
        },
        appKey,
        appSecret,
        method
      );
      
      results[method] = {
        success: !data.error_response,
        response: data
      };
      
      if (!data.error_response) {
        console.log(`✅ ${method} FUNCIONÓ!`);
      }
    } catch(e) {
      results[method] = { error: e.message };
    }
  }
  
  res.json({
    appKey,
    appSecretPrefix: appSecret?.substring(0, 10),
    appSecretSuffix: appSecret?.slice(-10),
    results
  });
});

// ============================================
// ENDPOINT PRINCIPAL
// ============================================
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
        // Probar con method1 primero, luego method2, luego method3
        let data = null;
        let workingMethod = null;
        
        for (const method of ['method1', 'method2', 'method3']) {
          try {
            data = await aliRequest(
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
              appSecret,
              method
            );
            
            if (!data.error_response) {
              workingMethod = method;
              console.log(`✅ Método working: ${method}`);
              break;
            }
          } catch(e) {
            console.log(`❌ ${method} falló:`, e.message);
          }
        }

        if (data && !data.error_response) {
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
          }
        } else {
          console.log('⚠️ Ningún método funcionó. Usando fallback.');
        }

      } catch(e) {
        console.log(' Error llamando AliExpress API:', e.message);
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
      source: products[0]?.source
    });

  } catch (error) {
    console.log('💥 Error general:', error.message);
    res.status(500).json({ error: 'Error interno', detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
