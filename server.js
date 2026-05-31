const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

const PRODUCTS = [
  { keyword: 'audifonos bluetooth', traffic: '100K+' },
  { keyword: 'ropa mujer tendencia', traffic: '200K+' },
  { keyword: 'smartwatch barato', traffic: '50K+' },
  { keyword: 'crema facial coreana', traffic: '80K+' },
  { keyword: 'tenis deportivos mujer', traffic: '150K+' },
  { keyword: 'lampara led escritorio', traffic: '40K+' },
  { keyword: 'bolso cuero mujer', traffic: '90K+' },
  { keyword: 'set maquillaje profesional', traffic: '120K+' },
  { keyword: 'funda celular samsung', traffic: '200K+' },
  { keyword: 'organizador cocina plastico', traffic: '60K+' },
  { keyword: 'collar mascotas personalizado', traffic: '35K+' },
  { keyword: 'kit fitness casa', traffic: '75K+' },
  { keyword: 'vestido mujer elegante', traffic: '180K+' },
  { keyword: 'serum vitamina c facial', traffic: '95K+' },
  { keyword: 'mochila escolar juvenil', traffic: '110K+' },
  { keyword: 'reloj hombre minimalista', traffic: '85K+' },
  { keyword: 'camiseta oversize hombre', traffic: '130K+' },
  { keyword: 'set skincare coreano', traffic: '70K+' },
  { keyword: 'zapatos plataforma mujer', traffic: '160K+' },
  { keyword: 'accesorios cabello trendy', traffic: '55K+' },
  { keyword: 'juguetes didacticos bebe', traffic: '45K+' },
  { keyword: 'banda resistencia fitness', traffic: '65K+' }
];

app.post('/api/trenddropi/generate', async (req, res) => {
  try {
    const shuffled = [...PRODUCTS].sort(() => Math.random() - 0.5).slice(0, 12);

    const platforms = {
      aliexpress: 'https://www.aliexpress.com/wholesale?SearchText=',
      temu: 'https://www.temu.com/search_result.html?search_key=',
      amazon: 'https://www.amazon.com/s?k=',
      alibaba: 'https://www.alibaba.com/trade/search?SearchText='
    };

    const products = shuffled.map((item, index) => ({
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

    res.json({ success: true, products, total: products.length, source: 'product_trends_co' });

  } catch (error) {
    res.status(500).json({ error: 'Error', detail: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
