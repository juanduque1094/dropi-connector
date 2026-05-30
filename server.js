const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

let dropiToken = null;

async function loginDropi() {
  try {
    const response = await axios.post('https://app.dropi.co/api/v1/auth/login', {
      email: process.env.DROPI_EMAIL,
      password: process.env.DROPI_PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    dropiToken = response.data.token || response.data.access_token || response.data.data?.token;
    console.log('Login Dropi exitoso');
    return true;
  } catch (error) {
    console.error('Error login Dropi:', error.response?.status, error.response?.data || error.message);
    return false;
  }
}

app.post('/api/trenddropi/generate', async (req, res) => {
  const { sources, country } = req.body;

  try {
    if (!dropiToken) {
      const ok = await loginDropi();
      if (!ok) {
        return res.status(401).json({ error: 'No se pudo autenticar con Dropi' });
      }
    }

    const response = await axios.get('https://app.dropi.co/api/v1/products', {
      headers: {
        'Authorization': `Bearer ${dropiToken}`,
        'Accept': 'application/json'
      },
      params: { country: country || 'CO', limit: 20 }
    });

    const products = response.data.data || response.data.products || response.data || [];

    res.json({ success: true, products, total: products.length });

  } catch (error) {
    if (error.response?.status === 401) {
      dropiToken = null;
    }
    res.status(500).json({ error: 'Error consultando Dropi', detail: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', dropi_connected: !!dropiToken });
});

app.listen(PORT, async () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  await loginDropi();
});
