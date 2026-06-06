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

    console.log(`🔍 Buscando problemas ESPECÍFICOS - País: ${country}, Período: ${timeframe}`);

    const results = {
      country,
      timeframe,
      timestamp: new Date().toISOString(),
      specificProblems: [],  // ✅ Problemas específicos
      relatedQueries: [],
      risingSearches: []
    };

    // ✅ KEYWORDS GENÉRICAS para obtener related_queries específicas
    const genericKeywords = [
      'dolor',
      'como quitar',
      'tratamiento',
      'remedio',
      'como eliminar',
      'problema',
      'enfermedad',
      'síntoma'
    ];

    for (const keyword of genericKeywords) {
      try {
        const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&api_key=${serpApiKey}&hl=es&gl=${country.toLowerCase()}&date=${encodeURIComponent(timeframe)}`;
        
        console.log(` Buscando: "${keyword}"`);
        
        const response = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        // ✅ EXTRAER RELATED QUERIES (problemas específicos)
        if (response.data?.related_queries?.top) {
          console.log(`✅ "${keyword}" tiene ${response.data.related_queries.top.length} consultas relacionadas`);
          
          for (const item of response.data.related_queries.top.slice(0, 10)) {
            if (item.query && item.extracted_value) {
              const specificProblem = item.query.toLowerCase();
              
              // Filtrar solo problemas específicos (más de 2 palabras)
              if (specificProblem.split(' ').length >= 2) {
                results.specificProblems.push({
                  keyword: specificProblem,
                  interest: item.extracted_value,
                  formattedInterest: String(item.extracted_value),
                  source: keyword,
                  timeframe: timeframe
                });
              }
            }
          }
        }

        // ✅ EXTRAER RISING QUERIES (tendencias en aumento)
        if (response.data?.related_queries?.rising) {
          for (const item of response.data.related_queries.rising.slice(0, 5)) {
            if (item.query && item.value) {
              results.risingSearches.push({
                query: item.query,
                value: item.value,
                keyword
              });
            }
          }
        }

      } catch (e) {
        console.log(`❌ Error con "${keyword}":`, e.message);
      }
    }

    // ✅ MÉTODO 2: People also ask de Google Search
    const searchQueries = [
      'problemas de salud comunes',
      'dolores más comunes',
      'enfermedades frecuentes',
      'como solucionar problemas'
    ];

    for (const search of searchQueries) {
      try {
        const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(search)}&api_key=${serpApiKey}&hl=es&gl=${country.toLowerCase()}&num=10`;
        
        const askResponse = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (askResponse.data?.people_also_ask) {
          for (const item of askResponse.data.people_also_ask.slice(0, 5)) {
            if (item.question) {
              const question = item.question;
              const extractedProblem = extractProblemFromQuestion(question);
              
              if (extractedProblem && extractedProblem.split(' ').length >= 3) {
                results.specificProblems.push({
                  keyword: extractedProblem,
                  interest: 0,
                  formattedInterest: 'N/A',
                  source: 'People also ask',
                  timeframe: timeframe
                });
              }
            }
          }
        }
      } catch (e) {
        console.log(`⚠️ Error en "People also ask":`, e.message);
      }
    }

    // Eliminar duplicados
    results.specificProblems = results.specificProblems.filter((item, index, self) => 
      index === self.findIndex(t => t.keyword === item.keyword)
    );

    // Ordenar por interés (mayor a menor)
    results.specificProblems.sort((a, b) => b.interest - a.interest);
    results.risingSearches.sort((a, b) => {
      const aVal = a.value === 'Breakout' ? 999999 : parseInt(a.value) || 0;
      const bVal = b.value === 'Breakout' ? 999999 : parseInt(b.value) || 0;
      return bVal - aVal;
    });

    console.log(`\n📊 Total problemas ESPECÍFICOS detectados: ${results.specificProblems.length}`);
    console.log(`📈 Consultas en aumento: ${results.risingSearches.length}\n`);

    // Mostrar primeros 10 problemas específicos
    console.log('🎯 Primeros problemas específicos:');
    results.specificProblems.slice(0, 10).forEach((p, i) => {
      console.log(`   ${i + 1}. "${p.keyword}" - Interés: ${p.interest}`);
    });

    return results;

  } catch (error) {
    console.log('❌ Error en getRealGoogleTrends:', error.message);
    throw error;
  }
}

function extractProblemFromQuestion(question) {
  const patterns = [
    /(?:cómo|como)\s+(?:eliminar|quitar|solucionar|arreglar|resolver)\s+(.+)/i,
    /(?:cuál|cual)\s+es\s+(?:el|la|mejor)\s+(?:tratamiento|remedio|solución)\s+(?:para|de)\s+(.+)/i,
    /(?:por\s+qué)\s+(?:me|le|te|nos)\s+(.+)/i,
    /(?:qué\s+hacer\s+(?:si|cuando|para))\s+(.+)/i,
    /(?:cómo\s+se)\s+(?:cura|trata|elimina|quita)\s+(.+)/i
  ];

  for (const pattern of patterns) {
    const match = question.toLowerCase().match(pattern);
    if (match && match[1] || match[2]) {
      const problem = (match[1] || match[2]).trim().replace(/[?¿]/g, '');
      return problem;
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

    if (trendsData.specificProblems.length === 0 && trendsData.risingSearches.length === 0) {
      console.log('⚠️ No se encontraron problemas específicos');
      return res.status(404).json({
        success: false,
        error: 'No se encontraron problemas específicos en Google para este período',
        message: 'Intenta con otro país o período de tiempo',
        metadata: {
          country,
          period,
          timeframe,
          timestamp: trendsData.timestamp
        }
      });
    }

    console.log(`✅ Enviando ${trendsData.specificProblems.length} problemas específicos al frontend`);

    res.json({
      success: true,
      data: trendsData,
      metadata: {
        totalProblems: trendsData.specificProblems.length,
        totalRising: trendsData.risingSearches.length,
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
    version: '5.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`\n Servidor corriendo en puerto ${PORT}`);
  console.log(`✅ Problemas ESPECÍFICOS de Google Trends`);
  console.log(`✅ Sin frases genéricas - Solo problemas concretos\n`);
});
