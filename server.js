const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

function fetchTrends() {
  return new Promise((resolve, reject) => {
    const url = 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=CO';
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseRSS(xml) {
  const items = [];
  const regex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const titleMatch = match[1].match(/<title>(.*?)<\/title>/);
    const trafficMatch = match[1].match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/);
    if (titleMatch) {
      items.push({
        keyword: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        traffic: trafficMatch ? trafficMatch[1] : '1K+'
      });
    }
  }
  return items;
}

app.post('/api/trenddropi/generate', async (req, res) => {
  try {
    const xml = await fetchTrends();
    const trends = parseRSS(xml).slice(0, 12);

    if (trends.length === 0) {
      return res.status(500).json({ error: 'No se encontraron tendencias' });
    }

    const platforms = {
      aliexpress: 'https://www.aliexpress.com/wholesale?SearchText=',
      temu: 'https://www.temu.com/search_result.html?search_key=',
      amazon: 'https://www.amazon.com/s?k=',
      alibaba: 'https://www.alibaba.com/trade/search?SearchText='
    };

    const products = trends.map((item, index) => ({
      id: index + 1,
      name: item.keyword,
      trend_score: Math.min(99, 70 + index * 2),
      traffic: item.traffic,
      source: 'Google Trends Colombia',
      search_url: {
        aliexpress: platforms.aliexpress + encodeURIComponent(item.keyword),
        temu: platforms.temu + encodeURIComponent(item.keyword),
        amazon: platforms.amazon + encodeURIComponent(item.keyword),
        alibaba: platforms.alibaba + encodeURIComponent(item.keyword)
      }
    }));

    res.json({ success: true, products, total: products.length, source: 'google_trends_rss_co' });
  } catch (error) {
    res.status(500).json({ error: 'Error consultando Google Trends', detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
