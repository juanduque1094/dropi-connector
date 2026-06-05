<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Radar Viral Dropshipping Colombia</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
            padding: 30px 20px;
        }

        header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        header p {
            font-size: 1.2em;
            opacity: 0.9;
        }

        .controls {
            text-align: center;
            margin-bottom: 40px;
        }

        .btn-generate {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            border: none;
            padding: 20px 60px;
            font-size: 1.3em;
            font-weight: bold;
            border-radius: 50px;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            transition: transform 0.3s, box-shadow 0.3s;
        }

        .btn-generate:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.4);
        }

        .btn-generate:active {
            transform: translateY(-1px);
        }

        .btn-generate:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .loading {
            display: none;
            text-align: center;
            color: white;
            margin: 40px 0;
        }

        .loading.active {
            display: block;
        }

        .spinner {
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }

        .product-card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s;
            animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .product-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }

        .product-image {
            width: 100%;
            height: 250px;
            object-fit: cover;
            background: #f0f0f0;
        }

        .product-info {
            padding: 20px;
        }

        .product-name {
            font-size: 1.1em;
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            line-height: 1.4;
        }

        .product-stats {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 15px 0;
            flex-wrap: wrap;
            gap: 10px;
        }

        .stat {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 0.9em;
        }

        .stat-icon {
            font-size: 1.2em;
        }

        .trend-score {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9em;
        }

        .traffic {
            color: #f5576c;
            font-weight: bold;
        }

        .product-price {
            font-size: 1.5em;
            color: #f5576c;
            font-weight: bold;
            margin: 10px 0;
        }

        .product-source {
            font-size: 0.8em;
            color: #999;
            margin-bottom: 15px;
        }

        .product-category {
            background: #667eea;
            color: white;
            padding: 3px 10px;
            border-radius: 10px;
            font-size: 0.75em;
            display: inline-block;
            margin-bottom: 10px;
        }

        .product-links {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .btn-link {
            flex: 1;
            min-width: 120px;
            padding: 12px;
            border: none;
            border-radius: 10px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            text-align: center;
            transition: opacity 0.3s;
        }

        .btn-link:hover {
            opacity: 0.8;
        }

        .btn-aliexpress {
            background: linear-gradient(135deg, #ff6b6b 0%, #f093fb 100%);
            color: white;
        }

        .error-message {
            display: none;
            background: rgba(255,255,255,0.95);
            color: #d63031;
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            margin: 20px 0;
        }

        .error-message.active {
            display: block;
        }

        .info-banner {
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 15px;
            border-radius: 15px;
            text-align: center;
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
        }

        .status-message {
            background: rgba(255,255,255,0.9);
            color: #333;
            padding: 15px;
            border-radius: 15px;
            text-align: center;
            margin: 20px 0;
            display: none;
        }

        .status-message.active {
            display: block;
        }

        @media (max-width: 768px) {
            header h1 {
                font-size: 2em;
            }
            
            .btn-generate {
                padding: 15px 40px;
                font-size: 1.1em;
            }
            
            .products-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎯 Radar Viral Dropshipping Colombia</h1>
            <p>Descubre los productos más vendidos y tendenciales en AliExpress</p>
        </header>

        <div class="info-banner">
            🔥 Encuentra productos ganadores para tu tienda de dropshipping
        </div>

        <div class="controls">
            <button class="btn-generate" onclick="generateProducts()" id="generateBtn">
                🚀 Generar Productos Tendenciales
            </button>
        </div>

        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>Buscando productos virales...</p>
            <p style="font-size: 0.9em; opacity: 0.8;">Esto puede tomar unos segundos</p>
        </div>

        <div class="status-message" id="statusMessage"></div>
        <div class="error-message" id="errorMessage"></div>

        <div class="products-grid" id="productsGrid"></div>
    </div>

    <script>
        const API_URL = 'https://dropi-connector.onrender.com/api/trenddropi/generate';

        async function generateProducts() {
            const btn = document.getElementById('generateBtn');
            const loading = document.getElementById('loading');
            const grid = document.getElementById('productsGrid');
            const errorDiv = document.getElementById('errorMessage');
            const statusDiv = document.getElementById('statusMessage');

            // Reset UI
            btn.disabled = true;
            loading.classList.add('active');
            grid.innerHTML = '';
            errorDiv.classList.remove('active');
            statusDiv.classList.remove('active');

            try {
                console.log('🔍 Iniciando petición a:', API_URL);
                
                // Verificar conexión primero
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos timeout
                
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                console.log('📥 Respuesta recibida:', response.status);

                if (!response.ok) {
                    throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                console.log('✅ Datos recibidos:', data);
                
                if (data.success && data.products && data.products.length > 0) {
                    showStatus(`✅ ${data.products.length} productos encontrados - Categoría: ${data.category || 'Varios'}`);
                    renderProducts(data.products);
                } else {
                    showError('No se encontraron productos. Intenta de nuevo.');
                }

            } catch (error) {
                console.error('❌ Error:', error);
                
                if (error.name === 'AbortError') {
                    showError('⏱️ La petición tardó demasiado. El servidor puede estar "dormido". Espera 1 minuto e intenta de nuevo.');
                } else if (error.message.includes('Failed to fetch')) {
                    showError('🌐 Error de conexión. Verifica tu internet o que el servidor esté activo.');
                } else {
                    showError('Error al conectar: ' + error.message);
                }
            } finally {
                btn.disabled = false;
                loading.classList.remove('active');
            }
        }

        function renderProducts(products) {
            const grid = document.getElementById('productsGrid');
            
            products.forEach((product, index) => {
                const card = createProductCard(product, index);
                grid.appendChild(card);
            });
        }

        function createProductCard(product, index) {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.animationDelay = `${index * 0.1}s`;

            const imageUrl = product.image || 'https://via.placeholder.com/300x250?text=Producto';
            const name = product.name || 'Producto sin nombre';
            const price = product.price ? `$${parseFloat(product.price).toFixed(2)} USD` : 'Precio no disponible';
            const traffic = product.traffic || 'N/A';
            const trendScore = product.trend_score || 0;
            const source = product.source || 'Desconocido';
            const category = product.category || '';
            const aliexpressUrl = product.search_url?.aliexpress || '#';

            card.innerHTML = `
                <img src="${imageUrl}" alt="${name}" class="product-image" onerror="this.src='https://via.placeholder.com/300x250?text=Imagen+no+disponible'">
                <div class="product-info">
                    ${category ? `<div class="product-category">${category.toUpperCase()}</div>` : ''}
                    <div class="product-name">${name}</div>
                    <div class="product-stats">
                        <div class="stat">
                            <span class="stat-icon">📊</span>
                            <span class="trend-score">${trendScore}/100</span>
                        </div>
                        <div class="stat">
                            <span class="stat-icon">🔥</span>
                            <span class="traffic">${traffic}</span>
                        </div>
                    </div>
                    <div class="product-price">${price}</div>
                    <div class="product-source">📍 ${source}</div>
                    <div class="product-links">
                        <a href="${aliexpressUrl}" target="_blank" class="btn-link btn-aliexpress">
                            Ver en AliExpress 🛒
                        </a>
                    </div>
                </div>
            `;

            return card;
        }

        function showError(message) {
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.textContent = message;
            errorDiv.classList.add('active');
            
            setTimeout(() => {
                errorDiv.classList.remove('active');
            }, 10000);
        }

        function showStatus(message) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.textContent = message;
            statusDiv.classList.add('active');
        }

        // Verificar salud del servidor al cargar
        window.addEventListener('load', async () => {
            try {
                const healthCheck = await fetch('https://dropi-connector.onrender.com/health');
                if (healthCheck.ok) {
                    console.log('✅ Servidor está activo');
                }
            } catch(e) {
                console.log('⚠️ Servidor puede estar inactivo');
            }
        });
    </script>
</body>
</html>
