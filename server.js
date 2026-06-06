const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

async function getRealGoogleTrends(country = 'CO', timeframe = 'now 7-d') {
  try {
    const serpApiKey = process.env.SERPAPI_KEY;
    
    if (!serpApiKey) {
      throw new Error('SERPAPI_KEY no configurada');
    }

    console.log(`🔍 Buscando tendencias REALES - País: ${country}, Período: ${timeframe}`);

    const results = {
      country,
      timeframe,
      timestamp: new Date().toISOString(),
      trendingSearches: [],
      relatedQueries: [],
      risingSearches: []
    };

    const problemKeywords = [
      'como solucionar',
      'como eliminar',
      'dolor de',
      'problema con',
      'como quitar',
      'tratamiento para',
      'remedio para',
      'como arreglar'
    ];

    for (const keyword of problemKeywords) {
      try {
        // ✅ URL CORRECTA con search.json (no search_json)
        const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&api_key=${serpApiKey}&hl=es&gl=${country.toLowerCase()}&date=${encodeURIComponent(timeframe)}`;
        
        console.log(`🔍 Request: ${url.substring(0, 120)}...`);
        
        const response = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        console.log(`✅ Respuesta para "${keyword}": Status ${response.status}`);

        if (response.data?.interest_over_time?.timeline_data) {
          const timelineData = response.data.interest_over_time.timeline_data;
          
          if (timelineData.length > 0) {
            const latestData = timelineData[timelineData.length - 1];
            const interest = latestData?.values?.[0]?.extracted_value || 
                            latestData?.values?.[0]?.value || 0;
            
            if (interest > 0) {
              results.trendingSearches.push({
                keyword: keyword,
                interest: interest,
                formattedInterest: String(interest),
                timeframe: timeframe,
                date: latestData?.date || new Date().toISOString()
              });
              console.log(`✅ "${keyword}": Interés REAL ${interest}`);
            }
          }
        }

        if (response.data?.related_queries?.rising) {
          for (const item of response.data.related_queries.rising.slice(0, 5)) {
            if (item.query && item.value) {
              results.risingSearches.push({
                query: item.query,
                value: item.value,
                link: item.link,
                keyword
              });
            }
          }
        }

        if (response.data?.related_queries?.top) {
          for (const item of response.data.related_queries.top.slice(0, 5)) {
            if (item.query && (item.extracted_value || item.value)) {
              results.relatedQueries.push({
                query: item.query,
                value: item.extracted_value || item.value,
                keyword
              });
            }
          }
        }

      } catch (e) {
        console.log(`❌ Error con "${keyword}":`, e.message);
        if (e.response) {
          console.log(`   Status: ${e.response.status}`);
          console.log(`   Data:`, JSON.stringify(e.response.data).substring(0, 200));
        }
      }
    }

    // Eliminar duplicados y ordenar
    results.trendingSearches = results.trendingSearches.filter((item, index, self) => 
      index === self.findIndex(t => t.keyword === item.keyword)
    );

    results.trendingSearches.sort((a, b) => b.interest - a.interest);
    results.risingSearches.sort((a, b) => {
      const aVal = a.value === 'Breakout' ? 999999 : parseInt(a.value) || 0;
      const bVal = b.value === 'Breakout' ? 999999 : parseInt(b.value) || 0;
      return bVal - aVal;
    });

    console.log(`\n📊 Total problemas REALES detectados: ${results.trendingSearches.length}`);
    console.log(`📈 Consultas en aumento REALES: ${results.risingSearches.length}`);
    console.log(`🔝 Consultas relacionadas REALES: ${results.relatedQueries.length}\n`);

    return results;

  } catch (error) {
    console.log('❌ Error en getRealGoogleTrends:', error.message);
    throw error;
  }
}

function extractProblemFromQuestion(question) {
  const patterns = [
    /(?:cómo|como)\s+(?:eliminar|quitar|solucionar|arreglar|resolver)\s+(.+)/i,
    /(?:cuál|cual)\s+es\s+(?:el|la)\s+(?:mejor|mejor\s+forma\s+de)\s+(.+)/i,
    /(?:por\s+qué)\s+(.+)/i,
    /(?:qué\s+hacer\s+si|cuando)\s+(.+)/i,
    /(?:cómo\s+se)\s+(.+)/i
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/[?¿]/g, '');
    }
  }

  return null;
}

app.get('/api/problems/real', async (req, res) => {
  try {
    const country = req.query.country || 'CO';
    const period = req.query.period || '7d';

    let timeframe = 'now 7-d';
    if (period === '15d') timeframe = 'now 15-d';
    if (period === '30d') timeframe = 'now 1-m';

    console.log(`\n📊 SOLICITUD: Período ${period} (${timeframe}) - País: ${country}`);

    const trendsData = await getRealGoogleTrends(country, timeframe);

    if (trendsData.trendingSearches.length === 0 && trendsData.risingSearches.length === 0) {
      console.log('⚠️ No se encontraron datos reales');
      return res.status(404).json({
        success: false,
        error: 'No se encontraron tendencias reales en Google para este período',
        message: 'Intenta con otro país o período de tiempo',
        metadata: {
          country,
          period,
          timeframe,
          timestamp: trendsData.timestamp
        }
      });
    }

    console.log(`✅ Enviando ${trendsData.trendingSearches.length} problemas al frontend`);

    res.json({
      success: true,
      data: trendsData,
      metadata: {
        totalTrending: trendsData.trendingSearches.length,
        totalRising: trendsData.risingSearches.length,
        totalRelated: trendsData.relatedQueries.length,
        country,
        period,
        timeframe,
        timestamp: trendsData.timestamp
      }
    });

  } catch (error) {
    console.log('❌ Error en endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener datos de Google Trends'
    });
  }
});

app.get('/api/problems/compare', async (req, res) => {
  try {
    const country = req.query.country || 'CO';
    console.log(`\n📊 COMPARANDO PERÍODOS - País: ${country}`);

    const [weekData, biweeklyData, monthlyData] = await Promise.all([
      getRealGoogleTrends(country, 'now 7-d'),
      getRealGoogleTrends(country, 'now 15-d'),
      getRealGoogleTrends(country, 'now 1-m')
    ]);

    res.json({
      success: true,
      comparison: {
        last7Days: weekData,
        last15Days: biweeklyData,
        last30Days: monthlyData
      },
      metadata: {
        country,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.log('❌ Error en comparación:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/problems/analyze/:keyword', async (req, res) => {
  try {
    const { keyword } = req.params;
    const country = req.query.country || 'CO';
    const serpApiKey = process.env.SERPAPI_KEY;

    console.log(`🔍 Analizando: "${keyword}"`);

    if (!serpApiKey) {
      throw new Error('SERPAPI_KEY no configurada');
    }

    const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&api_key=${serpApiKey}&hl=es&gl=${country.toLowerCase()}&date=now%2012-m`;

    const trendsResponse = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const analysis = {
      keyword,
      country,
      timestamp: new Date().toISOString(),
      interestOverTime: trendsResponse.data?.interest_over_time?.timeline_data || [],
      relatedQueries: trendsResponse.data?.related_queries || {},
      relatedTopics: trendsResponse.data?.related_topics || {},
      trend: calculateTrend(trendsResponse.data?.interest_over_time?.timeline_data)
    };

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.log(`❌ Error analizando "${keyword}":`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function calculateTrend(timelineData) {
  if (!timelineData || timelineData.length < 2) {
    return 'stable';
  }

  const recent = timelineData.slice(-3);
  const older = timelineData.slice(-6, -3);

  const recentAvg = recent.reduce((sum, item) => sum + (item.values?.[0]?.extracted_value || item.values?.[0]?.value || 0), 0) / recent.length;
  const olderAvg = older.reduce((sum, item) => sum + (item.values?.[0]?.extracted_value || item.values?.[0]?.value || 0), 0) / older.length;

  if (recentAvg > olderAvg * 1.2) return 'rising';
  if (recentAvg < olderAvg * 0.8) return 'declining';
  return 'stable';
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Google Trends Problem Detector',
    version: '4.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`✅ Solo Google Trends - 100% Datos Reales`);
  console.log(`✅ Sin AliExpress - Sin Fallback - URL Corregida\n`);
});
