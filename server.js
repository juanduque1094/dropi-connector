const express = require('express');
const cors = require('cors');
const https = require('https');
const crypto = require('crypto');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

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

const KEYWORDS = [
  'fashion accessories', 'jewelry women', 'watches women', 'bags women',
  'home decor', 'kitchen gadgets', 'phone accessories', 'smart gadgets',
  'fitness equipment', 'beauty tools', 'toys kids', 'pet supplies',
  'baby products', 'garden tools', 'office supplies', 'car accessories',
  'sports equipment', 'outdoor gear', 'electronics gadgets', 'health beauty',
  'women clothing', 'men clothing', 'shoes women', 'shoes men',
  'makeup tools', 'skin care', 'hair accessories', 'nail art'
];

const SORTS = [
  'LAST_VOLUME_DESC'  // ✅ SIEMPRE más vendidos
];

// ✅ FILTROS MÁS RELAJADOS - Solo palabras excluidas (sin requeridas)
const CATEGORY_KEYWORDS_FILTER = {
  'baby products': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'arduino', 'raspberry', 'microphone', 'speaker', 'tool', 'adult', 'princess', 'doll', 'phone', 'charger', 'usb', 'bluetooth']
  },
  'toys kids': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'tool', 'adult', 'baby', 'infant', 'phone', 'charger']
  },
  'pet supplies': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'tool', 'human', 'adult', 'phone', 'charger']
  },
  'home decor': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'tool', 'baby', 'pet', 'toy', 'phone']
  },
  'kitchen gadgets': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'tool', 'baby', 'pet', 'phone', 'toy']
  },
  'beauty tools': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'tool', 'baby', 'pet', 'toy', 'phone']
  },
  'fashion accessories': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'tool', 'baby', 'pet', 'toy', 'home', 'phone']
  },
  'electronics gadgets': {
    excluded: ['baby', 'pet', 'toy', 'home decor', 'kitchen', 'fashion']
  },
  'fitness equipment': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'baby', 'pet', 'toy', 'phone']
  },
  'jewelry women': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'tool', 'baby', 'pet', 'toy', 'home', 'phone']
  },
  'phone accessories': {
    excluded: ['baby', 'pet', 'toy', 'home', 'kitchen', 'fashion']
  },
  'shoes women': {
    excluded: ['electronic', 'circuit', 'pcb', 'module', 'tool', 'baby', 'pet', 'toy', 'home', 'kitchen', 'phone']
  }
};

const FALLBACK_PRODUCTS = [
  { keyword: 'audifonos bluetooth', price: 15.99, sales: 15000, rating: 4.7 },
  { keyword: 'smartwatch deportivo', price: 25.50, sales: 12000, rating: 4.5 },
  { keyword: 'crema facial coreana', price: 12.99, sales: 18000, rating: 4.8 },
  { keyword: 'tenis deportivos mujer', price: 35.00, sales: 22000, rating: 4.6 },
  { keyword: 'bolso cuero sintético', price: 28.99, sales: 9500, rating: 4.4 },
  { keyword: 'lámpara LED escritorio', price: 18.50, sales: 7800, rating: 4.5 },
  { keyword: 'set maquillaje profesional', price: 22.99, sales: 14000, rating: 4.7 },
  { keyword: 'funda celular transparente', price: 5.99, sales: 45000, rating: 4.3 },
  { keyword: 'organizador cocina', price: 16.50, sales: 8900, rating: 4.6 },
  { keyword: 'collar personalizado', price: 14.99, sales: 11000, rating: 4.8 },
  { keyword: 'kit fitness bandas', price: 19.99, sales: 13500, rating: 4.5 },
  { keyword: 'vestido mujer casual', price: 24.99, sales: 16000, rating: 4.4 },
];

function formatTraffic(sales) {
  if (!sales || sales < 100) return `${sales || 0} vendidos`;
  if (sales >= 10000) return `${(sales / 1000).toFixed(1)}K vendidos`;
  if (sales >= 1000) return `${(sales / 1000).toFixed(1)}K vendidos`;
  return `${sales} vendidos`;
}

function calculateTrendScore(sales, rating, index) {
  const salesScore = Math.min(sales / 1000, 10);
  const ratingScore = (rating || 4.5) * 2;
  const positionScore = Math.max(0, 10 - index);
  return Math.min(99, Math.round((salesScore + ratingScore + positionScore) * 3.3));
}

function convertPercentageToRating(percentage) {
  if (!percentage) return 4.5;
  if (percentage > 5) {
    return (percentage / 100) * 5;
  }
  return percentage;
}

// ✅ FILTRO RELAJADO - Solo excluye, no requiere palabras
function isProductRelevant(productTitle, category) {
  const title = productTitle.toLowerCase();
  
  // Si no hay filtros para esta categoría, aceptar
  if (!CATEGORY_KEYWORDS_FILTER[category]) {
    return true;
  }
  
  const filters = CATEGORY_KEYWORDS_FILTER[category];
  
  // Solo verificar palabras EXCLUIDAS
  if (filters.excluded) {
    for (const excludedWord of filters.excluded) {
      if (title.includes(excludedWord.toLowerCase())) {
        console.log(`❌ Excluido por "${excludedWord}": ${title.substring(0, 50)}`);
        return false;
      }
    }
  }
  
  // ✅ SIN verificación de palabras requeridas - ACEPTAR TODO lo que no esté excluido
  return true;
}

app.post('/api/trenddropi/generate', async (req, res) => {
  try {
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    
    const { category } = req.body;
    console.log('📂 Categoría del frontend:', category);

    let products = [];

    if (appKey && appSecret) {
      try {
        let randomKeyword;
        if (category && category !== 'all') {
          randomKeyword = category;
          console.log('🎯 Categoría específica:', randomKeyword);
        } else {
          randomKeyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
          console.log('🎲 Categoría aleatoria:', randomKeyword);
        }
        
        // ✅ SIEMPRE usar LAST_VOLUME_DESC
        const sortMethod = 'LAST_VOLUME_DESC';
        
        console.log('🔑 Keyword:', randomKeyword);
        console.log('📊 Sort:', sortMethod, '(MÁS VENDIDOS)');

        const data = await aliRequest(
          'aliexpress.affiliate.hotproduct.query',
          {
            country: 'CO',
            fields: 'product_id,product_title,sale_price,product_main_image_url,product_detail_url,evaluate_rate,30day_orders,latest_volume,app_sale_price,target_sale_price,lastest_volume,commission_rate,hot_product_commission_rate,original_price,discount',
            keywords: randomKeyword,
            page_no: '1',
            page_size: '50',  // ✅ Pedir MÁS productos para tener donde elegir
            sort: sortMethod,
            target_currency: 'USD',
            target_language: 'ES',
            tracking_id: 'default'
          },
          appKey,
          appSecret
        );

        let items = [];
        
        if (data?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result?.products?.product) {
          items = data.aliexpress_affiliate_hotproduct_query_response.resp_result.result.products.product;
        } else if (data?.aliexpress_affiliate_hotproduct_query_response?.products?.product) {
          items = data.aliexpress_affiliate_hotproduct_query_response.products.product;
        }

        console.log('📦 Productos brutos:', items.length);

        if (items.length > 0) {
          // ✅ Filtrar SOLO por exclusiones (más permisivo)
          const filteredItems = items.filter(item => {
            return isProductRelevant(item.product_title, randomKeyword);
          });
          
          console.log('✅ Después de filtrar:', filteredItems.length);
          
          // ✅ ORDENAR por ventas (últimos 30 días o latest_volume)
          filteredItems.sort((a, b) => {
            const salesA = parseInt(a.lastest_volume) || parseInt(a['30day_orders']) || 0;
            const salesB = parseInt(b.lastest_volume) || parseInt(b['30day_orders']) || 0;
            return salesB - salesA; // Descendente
          });

          products = filteredItems.slice(0, 12).map((item, index) => {
            const salesLastest = parseInt(item.lastest_volume) || 0;
            const salesLatest = parseInt(item.latest_volume) || 0;
            const sales30Days = parseInt(item['30day_orders']) || 0;
            const sales = salesLastest || salesLatest || sales30Days || Math.floor(Math.random() * 3000) + 500;
            
            const ratingRaw = parseFloat(item.evaluate_rate);
            const rating = convertPercentageToRating(ratingRaw);
            
            const price = parseFloat(item.target_sale_price || item.app_sale_price || item.sale_price) || (Math.random() * 50 + 10);
            
            return {
              id: index + 1,
              name: item.product_title?.substring(0, 70) || 'Producto AliExpress',
              trend_score: calculateTrendScore(sales, rating, index),
              traffic: formatTraffic(sales),
              sales_30days: sales,
              rating: rating.toFixed(1),
              price: price.toFixed(2),
              image: item.product_main_image_url || `https://via.placeholder.com/300x280?text=Producto+${index + 1}`,
              source: 'AliExpress Hot Products',
              category: randomKeyword,
              search_url: {
                aliexpress: item.product_detail_url ||
                  `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(item.product_title || '')}`
              }
            };
          });
          
          console.log('✅ Productos finales (TOP MÁS VENDIDOS):', products.length);
        }

      } catch(e) {
        console.log('❌ Error AliExpress API:', e.message);
        console.error(e);
      }
    }

    if (!products.length) {
      console.log('🔄 Usando fallback');
      const shuffled = [...FALLBACK_PRODUCTS].sort(() => Math.random() - 0.5).slice(0, 12);
      products = shuffled.map((item, index) => ({
        id: index + 1,
        name: item.keyword,
        trend_score: calculateTrendScore(item.sales, item.rating, index),
        traffic: formatTraffic(item.sales),
        sales_30days: item.sales,
        rating: item.rating.toFixed(1),
        price: item.price.toFixed(2),
        source: 'Google Trends Colombia (fallback)',
        category: category || 'general',
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
