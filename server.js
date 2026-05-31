const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

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

    const trends = searches.slice(0, 12).map(item => ({
      keyword: item.query || item.title || item.name || String(item)
    }));

    const platforms = {
      aliexpress: 'https://www.aliexpress.com/wholesale?SearchText=',
      temu: 'https://www.temu.com/search_result.html?search_key=',
      amazon: 'https://www.amazon.com/s?k=',
      alibaba: 'https://www.alibaba.com/trade/search?SearchText='
    };

    const products = trends.map((item, index) => ({
      id: index + 1,
      name: item.keyword,
      trend_score: Math.max(70, 99 - index * 2),
      source: 'Google Trends Colombia',
      search_url: {
        aliexpress: platforms.aliexpress + encodeURIComponent(item.keyword),
        temu: platforms.temu + encodeURIComponent(item.keyword),
        amazon: platforms.amazon + encodeURIComponent(item.keyword),
        alibaba: platforms.alibaba + encodeURIComponent(item.keyword)
      }
    }));

    res.json({ success: true, products, total: products.length, source: 'serpapi_trends_co' });

  } catch (error) {
    res.status(500).json({ error: 'Error consultando SerpApi', detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
