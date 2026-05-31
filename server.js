const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// Palabras clave que indican que NO es un producto vendible
const NO_PRODUCT_KEYWORDS = [
  'elecciones','votaciones','registraduria','presidente','congreso','senado','politica',
  'partido','candidato','gobierno','ministerio','alcalde','gobernador','reforma',
  'futbol','soccer','champions','mundial','liga','copa','torneo','partido','gol',
  'psg','arsenal','real madrid','barcelona','atletico','chelsea','manchester','liverpool',
  'noticias','accidente','muerto','muertos','masacre','ataque','explosión','sismo','terremoto',
  'fallecio','fallecidos','murio','murió','virus','pandemia','covid','vacuna',
  'novela','serie','pelicula','actor','cantante','musica','concierto','estreno',
  'dolar','euro','precio','inflacion','desempleo','economia','pib','impuesto'
];

// Palabras clave que indican que SÍ puede ser producto vendible
const PRODUCT_KEYWORDS = [
  'ropa','camiseta','zapatos','tenis','vestido','pantalon','falda','chaqueta','abrigo',
  'celular','telefono','audifonos','tablet','laptop','computador','camara','reloj','smartwatch',
  'hogar','cocina','decoracion','mueble','lampara','sofa','cama','organizador',
  'belleza','skincare','maquillaje','crema','serum','perfume','shampoo','cabello',
  'fitness','gym','ejercicio','pesas','yoga','suplemento','proteina','banda',
  'mascota','perro','gato','acuario','collar','correa','juguete',
  'bolso','cartera','mochila','maleta','accesorios','joyeria','anillo','collar',
  'juguete','niños','bebe','infantil','escolar','papeleria'
];

function isProductTrend(keyword) {
  const lower = keyword.toLowerCase();
  // Si contiene palabra de NO producto, descartar
  if (NO_PRODUCT_KEYWORDS.some(w => lower.includes(w))) return false;
  // Si contiene palabra de SÍ producto, incluir
  if (PRODUCT_KEYWORDS.some(w => lower.includes(w))) return true;
  // Si es corta y genérica, incluir (puede ser marca o producto nuevo)
  if (lower.split(' ').length <= 2 && lower.length < 20) return true;
  return false;
}

function serpFetch(apiKey) {
  return new Promise((resolve, reject) => {
    const url = `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=CO&api_key=${apiKey}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

app.post('/api/trenddropi/generate', async (req, res) => {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) return res.status(500).json({ error: 'SERPAPI_KEY no configurada' });

    const data = await serpFetch(apiKey);
    const searches = data.trending_searches || data.daily_searches || [];

    if (!searches.length) {
      return res.status(500).json({ error: 'Sin tendencias', raw: JSON.stringify(data).slice(0, 300) });
    }

    // Filtrar solo productos vendibles
    const allTrends = searches.map(item => item.query || item.title || item.name || String(item));
    const filtered = allTrends.filter(isProductTrend).slice(0, 12);
    
    // Si no hay suficientes productos filtrados, usar los primeros disponibles
    const trends = filtered.length >= 3 ? filtered : allTrends.slice(0, 12);

    const platforms = {
      aliexpress: 'https://www.aliexpress.com/wholesale?SearchText=',
      temu: 'https://www.temu.com/search_result.html?search_key=',
      amazon: 'https://www.amazon.com/s?k=',
      alibaba: 'https://www.alibaba.com/trade/search?SearchText='
    };

    const products = trends.map((keyword, index) => ({
      id: index + 1,
      name: keyword,
      trend_score: Math.max(70, 99 - index * 2),
      source: 'Google Trends Colombia',
      search_url: {
        aliexpress: platforms.aliexpress + encodeURIComponent(keyword),
        temu: platforms.temu + encodeURIComponent(keyword),
        amazon: platforms.amazon + encodeURIComponent(keyword),
        alibaba: platforms.alibaba + encodeURIComponent(keyword)
      }
    }));

    res.json({ success: true, products, total: products.length, source: 'serpapi_trends_co' });

  } catch (error) {
    res.status(500).json({ error: 'Error consultando SerpApi', detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
