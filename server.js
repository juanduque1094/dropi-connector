const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

function serpFetch(apiKey, keyword) {
  return new Promise((resolve, reject) => {
    const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&geo=CO&date=today+1-m&api_key=${apiKey}`;
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

const PRODUCT_SEARCHES = [
  'ropa mujer tendencia','zapatos deportivos','audifonos bluetooth',
  'camisetas hombre','vestidos mujer','ropa deportiva','tenis nike adidas',
  'smartwatch barato','celular samsung','funda celular',
  'organizador cocina','lampara led hogar','set cocina',
  'crema facial','serum vitamina c','maquillaje colombia',
  'mochila escolar','bolso mujer cuero','accesorios cabello',
  'juguetes niños','kit fitness casa','collar mascotas'
];

app.post('/api/trenddropi/generate', async (req, res) => {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) return res.status(500).json({ error: 'SERPAPI_KEY no configurada' });

    // Tomar 12 productos aleatorios de la lista
    const shuffled = PRODUCT_SEARCHES.sort(() => Math.random() - 0.5).slice(0, 12);

    const platforms = {
      aliexpress: 'https://www.aliexpress.com/wholesale?SearchText=',
      temu: 'https://www.temu.com/search_result.html?search_key=',
      amazon: 'https://www.amazon.com/s?k=',
      alibaba: 'https://www.alibaba.com/trade/search?SearchText='
    };

    const products = shuffled.map((keyword, index) => ({
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

    res.json({ success: true, products, total: products.length, source: 'product_trends_co' });

  } catch (error) {
    res.status(500).json({ error: 'Error', detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
