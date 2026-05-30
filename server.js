const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const DROPI_TOKEN = process.env.DROPI_TOKEN;

app.post('/api/trenddropi/generate', async (req, res) => {
  const { sources, country } = req.body;

  try {
    const response = await axios.post('https://app.dropi.co/api/v1/products', {
      country: country || 'CO',
      limit: 20
    }, {
      headers: {
        'dropi-integration-key': DROPI_TOKEN,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const products = response.data.objects || response.data.data || response.data.products || response.data || [];

    res.json({ success: true, products, total: Array.isArray(products) ? products.length : 0 });

  } catch (error) {
    console.error('Error Dropi:', error.response?.status, JSON.stringify(error.response?.data));
    res.status(500).json({ error: 'Error consultando Dropi', detail: error.message, status: error.response?.status });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', token_configured: !!DROPI_TOKEN });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Token configurado: ${!!DROPI_TOKEN}`);
});
