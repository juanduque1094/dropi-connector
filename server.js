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
// GOOGLE TRENDS - DETECTOR DE PROBLEMAS
// ============================================

// ✅ PALABRAS CLAVE DE PROBLEMAS/DOLORES
const PROBLEM_KEYWORDS = [
  'como eliminar', 'como quitar', 'dolor de', 'problema con',
  'solucion para', 'como arreglar', 'como limpiar', 'como organizar',
  'mejor producto para', 'como mejorar', 'como cuidar', 'como proteger',
  'tratamiento para', 'remedio para', 'como prevenir', 'como evitar'
];

// ✅ MAPEO DE PROBLEMAS A PRODUCTOS
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

async function getGoogleTrendsProblems(country = 'CO') {
  try {
    const serpApiKey = process.env.SERPAPI_KEY;
    
    // ✅ Obtener tendencias en tiempo real de Google
    const trendsResponse = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_trends_trending',
        api_key: serpApiKey,
        hl: 'es',
        gl: country.toLowerCase()
      }
    });

    console.log('📊 Google Trends Response:', trendsResponse.data);

    const problems = [];

    // Analizar tendencias actuales
    if (trendsResponse.data?.default?.trendingSearchesDays) {
      for (const day of trendsResponse.data.default.trendingSearchesDays.slice(0, 3)) {
        if (day.trendingSearches) {
          for (const trend of day.trendingSearches.slice(0, 5)) {
            const title = trend.title?.query?.toLowerCase() || '';
            
            // Verificar si es un problema/búsqueda de solución
            const isProblem = PROBLEM_KEYWORDS.some(keyword => 
              title.includes(keyword)
            );

            if (isProblem || trend.formattedTraffic > 50000) {
              problems.push({
                title: trend.title?.query || 'Unknown',
                traffic: trend.formattedTraffic || '0',
                trafficValue: parseInt(trend.formattedTraffic?.replace(/[^0-9]/g, '') || '0'),
                relatedQueries: trend.entityNames?.map(e => e.name) || [],
                date: day.date,
                isProblem: isProblem
              });
            }
          }
        }
      }
    }

    // ✅ Búsquedas relacionadas con problemas específicos
    const searchPromises = PROBLEM_KEYWORDS.slice(0, 5).map(async (keyword) => {
      try {
        const response = await axios.get('https://serpapi.com/search.json', {
          params: {
            engine: 'google_trends',
            q: keyword,
            api_key: serpApiKey,
            hl: 'es',
            gl: country.toLowerCase(),
            date: 'now 7-d'
          }
        });

        if (response.data?.interest_over_time?.timelineData) {
          const latest = response.data.interest_over_time.timelineData.slice(-1)[0];
          return {
            keyword,
            interest: latest.value?.[0] || 0,
            trending: latest.formattedValue?.[0] || '0'
          };
        }
      } catch(e) {
        console.log(`Error buscando ${keyword}:`, e.message);
      }
      return null;
    });

    const keywordResults = await Promise.all(searchPromises);
    const validKeywords = keywordResults.filter(r => r !== null);

    return {
      trending: problems,
      problemKeywords: validKeywords,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.log('❌ Error Google Trends:', error.message);
    return {
      trending: [],
      problemKeywords: [],
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================
// MAPEO DE PROBLEMAS A PRODUCTOS ALIEXPRESS
// ============================================

async function findProductsForProblem(problemData, appKey, appSecret) {
  const problem = problemData.title.toLowerCase();
  
  // Buscar en el mapeo
  let productInfo = null;
  for (const [key, value] of Object.entries(PROBLEM_TO_PRODUCT)) {
    if (problem.includes(key)) {
      productInfo = value;
      break;
    }
  }

  // Si no hay match exacto, usar categoría genérica
  if (!productInfo) {
    productInfo = {
      category: 'home decor',
      keywords: [problem.split(' ').slice(0, 2).join(' ')],
      urgency: 'medium',
      volume: 'medium'
    };
  }

  console.log(`🎯 Problema detectado: ${problem}`);
  console.log(`📦 Categoría sugerida: ${productInfo.category}`);
  console.log(`🔑 Keywords: ${productInfo.keywords.join(', ')}`);

  // Buscar productos en AliExpress
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

// ✅ ENDPOINT: Obtener problemas en tiempo real
app.get('/api/problems/trending', async (req, res) => {
  try {
    const country = req.query.country || 'CO';
    console.log(`🔍 Buscando problemas en tiempo real para: ${country}`);
    
    const trendsData = await getGoogleTrendsProblems(country);
    
    res.json({
      success: true,
      data: trendsData,
      totalProblems: trendsData.trending.length + trendsData.problemKeywords.length
    });
  } catch (error) {
    console.log('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ ENDPOINT: Problemas + Productos Solución
app.post('/api/problems/solutions', async (req, res) => {
  try {
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    const country = req.body.country || 'CO';
    
    console.log('🔍 Buscando soluciones para problemas...');

    // Obtener problemas de Google Trends
    const trendsData = await getGoogleTrendsProblems(country);
    
    // Para cada problema, buscar productos
    const solutions = [];
    
    for (const problem of trendsData.trending.slice(0, 5)) {
      if (problem.isProblem || problem.trafficValue > 100000) {
        const solution = await findProductsForProblem(problem, appKey, appSecret);
        if (solution.products.length > 0) {
          solutions.push(solution);
        }
      }
    }

    // Si no hay problemas detectados, usar keywords de problemas populares
    if (solutions.length === 0) {
      const fallbackProblems = [
        { title: 'dolor de espalda', traffic: '500K+', trafficValue: 500000 },
        { title: 'organizar casa', traffic: '200K+', trafficValue: 200000 },
        { title: 'cuidar piel', traffic: '300K+', trafficValue: 300000 }
      ];

      for (const problem of fallbackProblems) {
        const solution = await findProductsForProblem(problem, appKey, appSecret);
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

// ✅ ENDPOINT: Análisis completo de un problema específico
app.post('/api/problems/analyze', async (req, res) => {
  try {
    const { problem } = req.body;
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    
    console.log(`🔍 Analizando problema: ${problem}`);

    // 1. Obtener volumen de búsqueda en Google
    const serpApiKey = process.env.SERPAPI_KEY;
    let searchVolume = 0;
    let trend = 'stable';
    
    try {
      const trendsResponse = await axios.get('https://serpapi.com/search.json', {
        params: {
          engine: 'google_trends',
          q: problem,
          api_key: serpApiKey,
          hl: 'es',
          gl: 'co',
          date: 'now 12-m'
        }
      });

      if (trendsResponse.data?.interest_over_time?.timelineData) {
        const data = trendsResponse.data.interest_over_time.timelineData;
        const latest = data.slice(-1)[0].value?.[0] || 0;
        const previous = data.slice(-2, -1)[0]?.value?.[0] || 0;
        
        searchVolume = latest;
        trend = latest > previous ? 'rising' : latest < previous ? 'declining' : 'stable';
      }
    } catch(e) {
      console.log('Error getting trends:', e.message);
    }

    // 2. Buscar productos solución
    const solution = await findProductsForProblem(
      { title: problem, traffic: `${searchVolume}+`, trafficValue: searchVolume },
      appKey,
      appSecret
    );

    // 3. Calcular métricas
    const avgPrice = solution.products.reduce((sum, p) => 
      sum + parseFloat(p.target_sale_price || p.app_sale_price || p.sale_price || 0), 0
    ) / solution.products.length;

    const avgRating = solution.products.reduce((sum, p) => 
      sum + parseFloat(p.evaluate_rate || 0), 0
    ) / solution.products.length / 100 * 5;

    // 4. Score de oportunidad
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
