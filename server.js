const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.post('/api/trenddropi/generate', async (req, res) => {
  const { category } = req.body;

  try {
    const googleTrends = require('google-trends-api');
    
    const result = await googleTrends.dailyTrends({ geo: 'CO', hl: 'es' });
    const data = JSON.parse(result);
    const trends = data.default.trendingSearchesDays[0].trendingSearches
      .slice(0, 12)
      .map(t => t.title.query);

    const platforms = {
      aliexpress: 'https://www.aliexpress.com/wholesale?SearchText=',
      temu: 'https://www.temu.com/search_result.html?search_key=',
      amazon: 'https://www.amazon.com/s?k=',
      alibaba: 'https://www.alibaba.com/trade/search?SearchText='
    };

    const products = trends.map((keyword, index) => ({
      id: index + 1,
      name: keyword,
      trend_score: Math.floor(Math.random() * 30 + 70),
      source: 'Google Trends Colombia',
      search_url: {
        aliexpress: platforms.aliexpress + encodeURIComponent(keyword),
        temu: platforms.temu + encodeURIComponent(keyword),
        amazon: platforms.amazon + encodeURIComponent(keyword),
        alibaba: platforms.alibaba + encodeURIComponent(keyword)
      }
    }));

    res.json({ success: true, products, total: products.length, source: 'google_trends_co' });

  } catch (error) {
    res.status(500).json({ error: 'Error consultando Google Trends', detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
