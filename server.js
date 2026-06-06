const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// ============================================
// GOOGLE TRENDS - 100% DATOS REALES
// ============================================

async function getRealGoogleTrends(country = 'CO', timeframe = 'now 7-d') {
  try {
    const serpApiKey = process.env.SERPAPI_KEY;
    
    if (!serpApiKey) {
      throw new Error('SERPAPI_KEY no configurada en Render');
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

    // ✅ MÉTODO 1: Búsquedas con palabras de problema
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
        const response = await axios.get('https://serpapi.com/search.json', {
          params: {
            engine: 'google_trends',
            q: keyword,
            api_key: serpApiKey,
            hl: 'es',
            gl: country.toLowerCase(),
            date: timeframe
          },
          timeout: 15000
        });

        // ✅ Extraer interés REAL - Corregido scope
        if (response.data?.interest_over_time?.timelineData) {
          const timelineData = response.data.interest_over_time.timelineData;
          
          if (timelineData.length > 0) {
            const latestData = timelineData[timelineData.length - 1];
            const interest = latestData?.value?.[0] || 0;
            
            if (interest > 0) {
              results.trendingSearches.push({
                keyword: keyword,
                interest: interest,
                formattedInterest: latestData?.formattedValue?.[0] || String(interest),
                timeframe: timeframe,
                date: latestData?.formattedAxisTime || new Date().toISOString()
              });
              console.log(`✅ "${keyword}": Interés REAL ${interest}`);
            }
          }
        }

        // ✅ Extraer consultas en aumento REALES
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

        // ✅ Extraer consultas relacionadas REALES
        if (response.data?.related_queries?.top) {
          for (const item of response.data.related_queries.top.slice(0, 5)) {
            if (item.query && item.extracted_value) {
              results.relatedQueries.push({
                query: item.query,
                value: item.extracted_value,
                keyword
              });
            }
          }
        }

      } catch (e) {
        console.log(`⚠️ Error con "${keyword}":`, e.message);
      }
    }

    // ✅ MÉTODO 2: Tendencias generales
    try {
      console.log(' Buscando tendencias generales...');
      
      const generalResponse = await axios.get('https://serpapi.com/search.json', {
        params: {
          engine: 'google_trends',
          q: 'tendencias',
          api_key: serpApiKey,
          hl: 'es',
          gl: country.toLowerCase(),
          date: timeframe
        },
        timeout: 15000
      });

      if (generalResponse.data?.related_topics?.top) {
        for (const topic of generalResponse.data.related_topics.top.slice(0, 10)) {
          if (topic.topic?.mid && topic.topic?.title) {
            results.trendingSearches.push({
              keyword: topic.topic.title,
              interest: topic.value || 0,
              formattedInterest: topic.formattedValue || '0',
              type: 'topic',
              timeframe: timeframe
            });
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Error en tendencias generales:', e.message);
    }

    // ✅ MÉTODO 3: People also ask
    const commonSearches = [
      'problemas comunes',
      'como solucionar problemas',
      'dolor',
      'enfermedades',
      'remedios caseros'
    ];

    for (const search of commonSearches) {
      try {
        const askResponse = await axios.get('https://serpapi.com/search.json', {
          params: {
            engine: 'google',
            q: search,
            api_key: serpApiKey,
            hl: 'es',
            gl: country.toLowerCase(),
            num: 5
          },
          timeout: 15000
        });

        if (askResponse.data?.people_also_ask) {
          for (const item of askResponse.data.people_also_ask.slice(0, 3)) {
            if (item.question) {
              const question = item.question.toLowerCase();
              const extractedProblem = extractProblemFromQuestion(question);
              
              if (extractedProblem) {
                results.trendingSearches.push({
                  keyword: extractedProblem,
                  interest: 0,
                  formattedInterest: 'N/A',
                  type: 'question',
                  source: item.question,
                  timeframe: timeframe
                });
              }
            }
          }
        }
      } catch (e) {
        console.log(`⚠️ Error en "People also ask" para "${search}":`, e.message);
      }
    }

    // Eliminar duplicados
    results.trendingSearches = results.trendingSearches.filter((item, index, self) => 
      index === self.findIndex(t => t.keyword === item.keyword)
    );

    // Ordenar por interés REAL
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

// ✅ EXTRAER PROBLEMA DE PREGUNTA
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

// ============================================
// ENDPOINTS
// ============================================

// ✅ ENDPOINT: Obtener problemas reales
app.get('/api/problems/real', async (req, res) => {
  try {
    const country = req.query.country || 'CO';
    const period = req.query.period || '7d';

    let timeframe = 'now 7-d';
    if (period === '15d') timeframe = 'now 15-d';
    if (period === '30d') timeframe = 'now 1-m';

    console.log(`\n SOLICITUD: Período ${period} (${timeframe}) - País: ${country}`);

    const trendsData = await getRealGoogleTrends(country, timeframe);

    // ✅ Si no hay datos, responder con error pero NO caer
    if (trendsData.trendingSearches.length === 0 && trendsData.risingSearches.length === 0) {
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
    console.log(' Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Error al obtener datos de Google Trends'
    });
  }
});

// ✅ ENDPOINT: Comparar períodos
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
    console.log(' Error en comparación:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ ENDPOINT: Análisis detallado
app.get('/api/problems/analyze/:keyword', async (req, res) => {
  try {
    const { keyword } = req.params;
    const country = req.query.country || 'CO';
    const serpApiKey = process.env.SERPAPI_KEY;

    console.log(`🔍 Analizando: "${keyword}"`);

    if (!serpApiKey) {
      throw new Error('SERPAPI_KEY no configurada');
    }

    const trendsResponse = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_trends',
        q: keyword,
        api_key: serpApiKey,
        hl: 'es',
        gl: country.toLowerCase(),
        date: 'now 12-m'
      },
      timeout: 15000
    });

    const analysis = {
      keyword,
      country,
      timestamp: new Date().toISOString(),
      interestOverTime: trendsResponse.data?.interest_over_time?.timelineData || [],
      relatedQueries: trendsResponse.data?.related_queries || {},
      relatedTopics: trendsResponse.data?.related_topics || {},
      trend: calculateTrend(trendsResponse.data?.interest_over_time?.timelineData)
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

// ✅ CALCULAR TENDENCIA
function calculateTrend(timelineData) {
  if (!timelineData || timelineData.length < 2) {
    return 'stable';
  }

  const recent = timelineData.slice(-3);
  const older = timelineData.slice(-6, -3);

  const recentAvg = recent.reduce((sum, item) => sum + (item.value?.[0] || 0), 0) / recent.length;
  const olderAvg = older.reduce((sum, item) => sum + (item.value?.[0] || 0), 0) / older.length;

  if (recentAvg > olderAvg * 1.2) return 'rising';
  if (recentAvg < olderAvg * 0.8) return 'declining';
  return 'stable';
}

// ✅ Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Google Trends Problem Detector',
    version: '2.0.0'
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Solo Google Trends - 100% Datos Reales`);
  console.log(` Sin AliExpress - Sin Fallback\n`);
});
