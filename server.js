const express = require('express');
const cors = require('cors');
const https = require('https');
const crypto = require('crypto');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// ✅ Firma AliExpress - Método verificado 2026
function sign(appSecret, params) {
  // 1. Filtrar parámetros (excluir 'sign' y valores undefined/null)
  const filteredParams = {};
  Object.keys(params).forEach(key => {
    if (key !== 'sign' && params[key] !== undefined && params[key] !== null && params[key] !== '') {
      filteredParams[key] = params[key];
    }
  });

  // 2. Ordenar parámetros alfabéticamente por CLAVE
  const sortedKeys = Object.keys(filteredParams).sort();
  
  // 3. Concatenar: key + value (SIN separadores, SIN signos de igual)
  let strToSign = '';
  sortedKeys.forEach(key => {
    strToSign += key + filteredParams[key];
  });
  
  // 4. Agregar appSecret al inicio y al final
  strToSign = appSecret + strToSign + appSecret;
  
  // 5. HMAC-SHA256 y convertir a MAYÚSCULAS
  const signature = crypto
    .createHmac('sha256', appSecret)
    .update(strToSign, 'utf8')
    .digest('hex')
    .toUpperCase();
  
  console.log('🔐 String a firmar:', strToSign.substring(0, 100) + '...');
  console.log('🔐 Firma generada:', signature);
  
  return signature;
}

// ✅ Timestamp UTC
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
    // Parámetros base
    const baseParams = {
      app_key: appKey,
      format: 'json',
      method: method,
      sign_method: 'hmac-sha256',
      timestamp: getTimestamp(),
      v: '2.0',
      ...params
    };

    // Generar firma ANTES de construir el body
    const signature = sign(appSecret, baseParams);
    baseParams.sign = signature;

    // Construir body URL-encoded ORDENADO alfabéticamente
    const sortedKeys = Object.keys(baseParams).sort();
    const bodyParts = [];
    sortedKeys.forEach(key => {
      bodyParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(baseParams[key])}`);
    });
    const body = bodyParts.join('&');

    console.log('🔍 Método:', method);
    console.log('🔍 Timestamp:', baseParams.timestamp);
    console.log('🔍 Body completo ordenado:', body);

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
        console.log('📦 AliExpress RAW response:', data.substring(0, 1000));
        try {
          const parsed = JSON.parse(data);
          
          // Verificar si hay error de firma
          if (parsed.error_response && parsed.error_response.code === 'IncompleteSignature') {
            console.error('❌ ERROR DE FIRMA - Verifica appSecret');
          }
          
          resolve(parsed);
        } catch(e) {
          reject(new Error('No se pudo parsear respuesta: ' + data.substring(0, 200)));
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('❌ Error en request:', e.message);
      reject(e);
    });
    
    req.write(body);
    req.end();
  });
}

// Fallback
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

        console.log('✅ Respuesta parseada:', JSON.stringify(data, null, 2).substring(0, 1000));

        // Extraer productos
        let items = [];
        if (data?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result?.products?.product) {
          items = data.aliexpress_affiliate_hotproduct_query_response.resp_result.result.products.product;
        } else if (data?.aliexpress_affiliate_hotproduct_query_response?.products?.product) {
          items = data.aliexpress_affiliate_hotproduct_query_response.products.product;
        }

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
        console.error(e);
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
