const express = require('express');
const cors = require('cors');
const https = require('https');
const crypto = require('crypto');
const axios = require('axios');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// ============================================
// ALIEXPRESS API FUNCTIONS
// ============================================
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

// ============================================
// GOOGLE TRENDS - CORREGIDO
// ============================================

const PROBLEM_KEYWORDS = [
  'como eliminar', 'como quitar', 'dolor de', 'problema con',
  'solucion para', 'como arreglar', 'como limpiar', 'como organizar',
  'mejor producto para', 'como mejorar', 'como cuidar', 'como proteger',
  'tratamiento para', 'remedio para', 'como prevenir', 'como evitar'
];

const PROBLEM_TO_PRODUCT = {
  'dolor de espalda': {
    category: 'fitness equipment',
    keywords: ['corrector postura', 'cojin lumbar', 'faja espalda'],
    urgency: 'high',
    volume: 'very_high'
  },
  'dolor de cuello': {
    category: 'home decor',
    keywords: ['almohada cervical', 'soporte cuello', 'masajeador cuello'],
    urgency: 'high',
    volume: 'high'
  },
  'organizar casa': {
    category: 'home decor',
    keywords: ['organizador', 'cajas almacenamiento', 'estante'],
    urgency: 'medium',
    volume: 'very_high'
  },
  'limpiar casa': {
    category: 'kitchen gadgets',
    keywords: ['mopa', 'aspiradora', 'cepillo limpieza'],
    urgency: 'medium',
    volume: 'very_high'
  },
  'cuidar piel': {
    category: 'beauty tools',
    keywords: ['crema facial', 'serum', 'mascarilla'],
    urgency: 'medium',
    volume: 'very_high'
  },
  'perder peso': {
    category: 'fitness equipment',
    keywords: ['bandas resistencia', 'pesas', 'ropa deportiva'],
    urgency: 'high',
    volume: 'very_high'
  },
  'cuidar mascotas': {
    category: 'pet supplies',
    keywords: ['juguete perro', 'cama mascota', 'correa'],
    urgency: 'medium',
    volume: 'high'
  },
  'proteger celular': {
    category: 'phone accessories',
    keywords: ['funda celular', 'protector pantalla', 'soporte celular'],
    urgency: 'medium',
    volume: 'very_high'
  },
  'mejorar sueño': {
    category: 'home decor',
    keywords: ['antifaz', 'almohada', 'difusor aromas'],
    urgency: 'high',
    volume: 'high'
  },
  'ahorrar energia': {
    category: 'home decor',
    keywords: ['bombillo led', 'temporizador', 'regleta'],
    urgency: 'medium',
    volume: 'medium'
  }
};

// ✅ FUNCIÓN CORREGIDA - Usa endpoints válidos de SerpApi
async function getGoogleTrendsProblems(country = 'CO') {
  try {
    const serpApiKey = process.env.SERPAPI_KEY;
    
    if (!serpApiKey) {
      console.log('⚠️ SERPAPI_KEY no configurada');
      return getFallbackProblems();
    }

    console.log(' Usando SERPAPI_KEY:', serpApiKey.substring(0, 10) + '...');

    const problems = [];

    // ✅ MÉTODO 1: Buscar tendencias específicas con google_trends
    const searchQueries = ['dolor de espalda', 'organizar casa', 'cuidar piel', 'perder peso', 'mejorar sueño'];
    
    for (const query of searchQueries) {
      try {
        const response = await axios.get('https://serpapi.com/search.json', {
          params: {
            engine: 'google_trends',
            q: query,
            api_key: serpApiKey,
            hl: 'es',
            gl: country.toLowerCase(),
            date: 'now 7-d'
          },
          timeout: 10000
        });

        console.log(`📊 Respuesta para "${query}":`, response.data?.search_metadata?.status);

        if (response.data?.interest_over_time?.timelineData) {
          const data = response.data.interest_over_time.timelineData;
          const latest = data.slice(-1)[0];
          const interest = latest.value?.[0] || 0;
          
          if (interest > 0) {
            problems.push({
              title: query,
              traffic: `${interest * 1000}+`,
              trafficValue: interest * 1000,
              interest: interest,
              date: new Date().toISOString(),
              isProblem: true
            });
          }
        }
      } catch(e) {
        console.log(`️ Error buscando "${query}":`, e.message);
      }
    }

    // ✅ MÉTODO 2: Búsquedas relacionadas (related_queries)
    try {
      const relatedResponse = await axios.get('https://serpapi.com/search.json', {
        params: {
          engine: 'google_trends',
          q: 'productos tendencia',
          api_key: serpApiKey,
          hl: 'es',
          gl: country.toLowerCase(),
          date: 'now 7-d'
        },
        timeout: 10000
      });

      if (relatedResponse.data?.related_queries?.rising) {
        for (const item of relatedResponse.data.related_queries.rising.slice(0, 5)) {
          problems.push({
            title: item.query,
            traffic: item.value || 'N/A',
            trafficValue: parseInt(item.value) || 0,
            interest: 50,
            date: new Date().toISOString(),
            isProblem: true
          });
        }
      }
    } catch(e) {
      console.log('⚠️ Error en related_queries:', e.message);
    }

    if (problems.length === 0) {
      console.log('⚠️ No se encontraron problemas, usando fallback');
      return getFallbackProblems();
    }

    return {
      trending: problems,
      problemKeywords: [],
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.log('❌ Error Google Trends:', error.message);
    return getFallbackProblems();
  }
}

// ✅ FALLBACK - Problemas predefinidos
function getFallbackProblems() {
  return {
    trending: [
      { title: 'dolor de espalda', traffic: '500K+', trafficValue: 500000, interest: 95, isProblem: true },
      { title: 'organizar casa', traffic: '200K+', trafficValue: 200000, interest: 85, isProblem: true },
      { title: 'cuidar piel', traffic: '300K+', trafficValue: 300000, interest: 90, isProblem: true },
      { title: 'perder peso', traffic: '800K+', trafficValue: 800000, interest: 98, isProblem: true },
      { title: 'mejorar sueño', traffic: '150K+', trafficValue: 150000, interest: 80, isProblem: true }
    ],
    problemKeywords: [],
    timestamp: new Date().toISOString()
  };
}

// ============================================
// BUSCAR PRODUCTOS PARA PROBLEMAS
// ============================================

async function findProductsForProblem(problemData, appKey, appSecret) {
  const problem = problemData.title.toLowerCase();
  
  let productInfo = null;
  for (const [key, value] of Object.entries(PROBLEM_TO_PRODUCT)) {
    if (problem.includes(key)) {
      productInfo = value;
      break;
    }
  }

  if (!productInfo) {
    productInfo = {
      category: 'home decor',
      keywords: [problem.split(' ').slice(0, 2).join(' ')],
      urgency: 'medium',
      volume: 'medium'
    };
  }

  console.log(`🎯 Problema: ${problem}`);
  console.log(`📦 Categoría: ${productInfo.category}`);
  console.log(`🔑 Keywords: ${productInfo.keywords.join(', ')}`);

  const products = [];
  
  for (const keyword of productInfo.keywords.slice(0, 2)) {
    try {
      const data = await aliRequest(
        'aliexpress.affiliate.hotproduct.query',
        {
          country: 'CO',
          fields: 'product_id,product_title,sale_price,product_main_image_url,product_detail_url,evaluate_rate,lastest_volume,latest_volume,30day_orders,app_sale_price,target_sale_price',
          keywords: keyword,
          page_no: '1',
          page_size: '6',
          sort: 'LAST_VOLUME_DESC',
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
      }

      products.push(...items.slice(0, 3));
    } catch(e) {
      console.log(`Error buscando ${keyword}:`, e.message);
    }
  }

  return {
    problem: problemData,
    productInfo,
    products: products.slice(0, 6)
  };
}

// ============================================
// ENDPOINTS
// ============================================

app.get('/api/problems/trending', async (req, res) => {
  try {
    const country = req.query.country || 'CO';
    console.log(`🔍 Buscando problemas para: ${country}`);
    
    const trendsData = await getGoogleTrendsProblems(country);
    
    res.json({
      success: true,
      data: trendsData,
      totalProblems: trendsData.trending.length
    });
  } catch (error) {
    console.log('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/problems/solutions', async (req, res) => {
  try {
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    const country = req.body.country || 'CO';
    
    console.log('🔍 Buscando soluciones para problemas...');

    const trendsData = await getGoogleTrendsProblems(country);
    
    const solutions = [];
    
    for (const problem of trendsData.trending.slice(0, 5)) {
      const solution = await findProductsForProblem(problem, appKey, appSecret);
      if (solution.products.length > 0) {
        solutions.push(solution);
      }
    }

    res.json({
      success: true,
      problems: solutions,
      total: solutions.length,
      country,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.log('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/problems/analyze', async (req, res) => {
  try {
    const { problem } = req.body;
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    
    console.log(`🔍 Analizando: ${problem}`);

    const serpApiKey = process.env.SERPAPI_KEY;
    let searchVolume = 0;
    let trend = 'stable';
    
    if (serpApiKey) {
      try {
        const trendsResponse = await axios.get('https://serpapi.com/search.json', {
          params: {
            engine: 'google_trends',
            q: problem,
            api_key: serpApiKey,
            hl: 'es',
            gl: 'co',
            date: 'now 12-m'
          },
          timeout: 10000
        });

        if (trendsResponse.data?.interest_over_time?.timelineData) {
          const data = trendsResponse.data.interest_over_time.timelineData;
          const latest = data.slice(-1)[0].value?.[0] || 0;
          const previous = data.slice(-2, -1)[0]?.value?.[0] || 0;
          
          searchVolume = latest;
          trend = latest > previous ? 'rising' : latest < previous ? 'declining' : 'stable';
        }
      } catch(e) {
        console.log('Error trends:', e.message);
      }
    }

    const solution = await findProductsForProblem(
      { title: problem, traffic: `${searchVolume}+`, trafficValue: searchVolume },
      appKey,
      appSecret
    );

    const avgPrice = solution.products.reduce((sum, p) => 
      sum + parseFloat(p.target_sale_price || p.app_sale_price || p.sale_price || 0), 0
    ) / solution.products.length;

    const avgRating = solution.products.reduce((sum, p) => 
      sum + parseFloat(p.evaluate_rate || 0), 0
    ) / solution.products.length / 100 * 5;

    const opportunityScore = Math.min(100, Math.round(
      (searchVolume / 1000) * 0.4 +
      (solution.products.length > 0 ? 30 : 0) +
      (trend === 'rising' ? 20 : trend === 'stable' ? 10 : 0) +
      (avgRating >= 4 ? 10 : 0)
    ));

    res.json({
      success: true,
      problem,
      metrics: {
        searchVolume,
        trend,
        competition: solution.products.length,
        avgPrice: avgPrice.toFixed(2),
        avgRating: avgRating.toFixed(1),
        opportunityScore
      },
      products: solution.products.slice(0, 6).map(item => ({
        title: item.product_title,
        price: parseFloat(item.target_sale_price || item.app_sale_price || item.sale_price || 0).toFixed(2),
        rating: (parseFloat(item.evaluate_rate || 0) / 100 * 5).toFixed(1),
        sales: parseInt(item.lastest_volume || item.latest_volume || item['30day_orders'] || 0),
        image: item.product_main_image_url,
        url: item.product_detail_url
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.log('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
