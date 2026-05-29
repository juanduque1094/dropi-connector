const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Token de sesión Dropi (se obtiene al hacer login)
let dropiToken = null;

async function loginDropi() {
  try {
    const response = await axios.post('https://app.dropi.co/api/auth/login', {
      email: process.env.DROPI_EMAIL,
      password: process.env.DROPI_PASSWORD
    });
    dropiToken = response.data.token || response.data.access_token;
    console.log('Login Dropi exitoso');
  } catch (error) {
    console.error('Error login Dropi:', error.message);
  }
}

app.post('/api/trenddropi/generate', async (req, res) => {
  const { sources, country } = req.body;

  try {
    // Si no hay token, hacer login primero
    if (!dropiToken) {
      await loginDropi();
    }

    // Buscar productos en Dropi
    const response = await axios.get('https://app.dropi.co/api/products', {
      headers: {
        'Authorization': `Bearer ${dropiToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        country: country || 'CO',
        limit: 20
      }
    });

    const products = response.data.data || response.data.products || [];

    res.json({
      success: true,
      sources: sources,
      country: country,
      products: products,
      total: products.length
    });

  } catch (error) {
    console.error('Error consultando Dropi:', error.message);

    // Si el token expiró, intentar login de nuevo
    if (error.response && error.response.status === 401) {
      dropiToken = null;
      return res.status(401).json({ error: 'Token expirado, intenta de nuevo' });
    }

    res.status(500).json({ 
      error: 'Error consultando Dropi',
      detail: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', dropi_connected: !!dropiToken });
});

app.listen(PORT, async () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  await loginDropi();
});
