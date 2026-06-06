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

        // Extraer interés REAL
        if (response.data?.interest_over_time?.timelineData) {
          const timelineData = response.data.interest_over_time.timelineData;
          const latestData = timelineData[timelineData.length - 1];
          const interest = latestData?.value?.[0] || 0;
          
          if (interest > 0) {
            results.trendingSearches.push({
              keyword: keyword,
              interest: interest, // ✅ VALOR REAL de Google
              formattedInterest: latestData?.formattedValue?.[0] || '0',
              timeframe: timeframe,
              date: latestData?.formattedAxisTime || new Date().toISOString()
            });
            console.log(`✅ "${keyword}": Interés REAL ${interest}`);
          }
        }

        // Extraer consultas en aumento REALES
        if (response.data?.related_queries?.rising) {
          for (const item of response.data.related_queries.rising.slice(0, 5)) {
            if (item.query && item.value) {
              results.risingSearches.push({
                query: item.query,
                value: item.value, // ✅ VALOR REAL (puede ser "Breakout")
                link: item.link,
                keyword
              });
            }
          }
        }

        // Extraer consultas relacionadas REALES
        if (response.data?.related_queries?.top) {
          for (const item of response.data.related_queries.top.slice(0, 5)) {
            if (item.query && item.extracted_value) {
              results.relatedQueries.push({
                query: item.query,
                value: item.extracted_value, // ✅ VALOR REAL
                keyword
              });
            }
          }
        }

      } catch (e) {
        console.log(`⚠️ Error con "${keyword}":`, e.message);
        // NO agregar nada si falla - solo datos reales
      }
    }

    // ✅ MÉTODO 2: Tendencias generales
    try {
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
              interest: topic.value || 0, // ✅ VALOR REAL
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

    // ✅ MÉTODO 3: People also ask (SOLO si hay datos reales)
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
                // ✅ NO usar Math.random() - Solo agregar el problema sin interés estimado
                results.trendingSearches.push({
                  keyword: extractedProblem,
                  interest: 0, // ✅ Sin valor estimado - solo datos reales
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

    // Ordenar por interés REAL (mayor a menor)
    results.trendingSearches.sort((a, b) => b.interest - a.interest);
    results.risingSearches.sort((a, b) => {
      const aVal = a.value === 'Breakout' ? 999999 : parseInt(a.value) || 0;
      const bVal = b.value === 'Breakout' ? 999999 : parseInt(b.value) || 0;
      return bVal - aVal;
    });

    console.log(`\n📊 Total problemas REALES detectados: ${results.trendingSearches.length}`);
    console.log(`📈 Consultas en aumento REALES: ${results.risingSearches.length}`);
    console.log(`🔝 Consultas relacionadas REALES: ${results.relatedQueries.length}\n`);

    // ✅ VALIDACIÓN ESTRICTA: Si no hay datos reales, LANZAR ERROR
    if (results.trendingSearches.length === 0 && results.risingSearches.length === 0) {
      throw new Error('No se encontraron tendencias REALES en Google para este período. Intenta con otro país o período.');
    }

    return results;

  } catch (error) {
    console.log('❌ Error en getRealGoogleTrends:', error.message);
    throw error; // ✅ Propagar error - NUNCA fallback
  }
}
