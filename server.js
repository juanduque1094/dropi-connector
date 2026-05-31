const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CO,es;q=0.9',
        'Cache-Control': 'no-cache'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchRSS(res.headers.location).then(resolve).catch(reject);
      }
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
    const titleMatch = match[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || match[1].match(/<title>(.*?)<\/title>/);
    const trafficMatch = match[1].match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/);
    if (titleMatch) {
      items.push({
        keyword: titleMatch[1].trim(),
        traffic: trafficMatch ? trafficMatch[1] : '1K+'
      });
    }
  }
  return items;
}

app.post('/api/trenddropi/generate', async (req, res) => {
  try {
    const urls = [
      'https://trends.google.com/trends/trendingsearches/daily/rss?geo=CO',
      'https://trends.google.es/trends/trendingsearches/daily/rss?geo=CO'
    ];
    
    let xml = '';
    let lastError = null;
    
    for (const url of urls) {
      try {
        xml = await fetchRSS(url);
        if (xml.includes('<item>')) break;
      } catch(e) {
        lastError = e;
      }
    }

    const trends = parseRSS(xml).slice(0, 12);

    if (trends.length === 0) {
      return res.status(500).json({ 
        error: 'Google Trends no devolvió datos', 
        detail: lastError?.message || 'Sin items en el RSS',
        raw_length: xml.length
      });
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
      trend_score: Math.max(70, 99 - index * 2),
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
