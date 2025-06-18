/**
 * Modern Product Catalog Application
 * Fetches data from Google Sheets and displays products with filtering, sorting, and pagination
 */

class ProductCatalog {
    constructor() {
        // Configuration
        this.config = {
            googleSheetUrl: '',
            whatsappNumber: '9471',
            productsPerPage: 12,
            debounceDelay: 300
        };

        // State
        this.state = {
            allProducts: [],
            filteredProducts: [],
            currentPage: 1,
            totalPages: 0,
            filters: {
                search: '',
                category: '',
                priceMin: 0,
                priceMax: 1000,
                inStockOnly: false,
                sortBy: 'name'
            },
            selectedProduct: null
        };

        // DOM Elements
        this.elements = {
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('error-message'),
            errorText: document.getElementById('error-text'),
            productsGrid: document.getElementById('products-grid'),
            noProducts: document.getElementById('no-products'),
            productCount: document.getElementById('product-count'),
            pagination: document.getElementById('pagination'),
            
            // Filters
            searchInput: document.getElementById('search-input'),
            categoryFilter: document.getElementById('category-filter'),
            sortSelect: document.getElementById('sort-select'),
            stockFilter: document.getElementById('stock-filter'),
            priceRangeMin: document.getElementById('price-range-min'),
            priceRangeMax: document.getElementById('price-range-max'),
            priceRangeLabel: document.getElementById('price-range-label'),
            
            // Modal
            orderModal: new bootstrap.Modal(document.getElementById('orderModal')),
            modalProductImage: document.getElementById('modal-product-image'),
            modalProductName: document.getElementById('modal-product-name'),
            modalProductId: document.getElementById('modal-product-id'),
            modalProductCategory: document.getElementById('modal-product-category'),
            modalProductDescription: document.getElementById('modal-product-description'),
            modalPriceDisplay: document.getElementById('modal-price-display'),
            modalTotalPrice: document.getElementById('modal-total-price'),
            quantityInput: document.getElementById('quantity-input'),
            quantityDecrease: document.getElementById('quantity-decrease'),
            quantityIncrease: document.getElementById('quantity-increase'),
            whatsappOrderBtn: document.getElementById('whatsapp-order-btn')
        };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.fetchProducts();
    }

    setupEventListeners() {
        // Search with debounce
        this.elements.searchInput.addEventListener('input', 
            this.debounce(() => this.handleFilterChange(), this.config.debounceDelay)
        );

        // Filter and sort events
        this.elements.categoryFilter.addEventListener('change', () => this.handleFilterChange());
        this.elements.sortSelect.addEventListener('change', () => this.handleFilterChange());
        this.elements.stockFilter.addEventListener('change', () => this.handleFilterChange());
        
        // Price range events
        this.elements.priceRangeMin.addEventListener('input', () => this.handlePriceRangeChange());
        this.elements.priceRangeMax.addEventListener('input', () => this.handlePriceRangeChange());

        // Modal quantity controls
        this.elements.quantityDecrease.addEventListener('click', () => this.changeQuantity(-1));
        this.elements.quantityIncrease.addEventListener('click', () => this.changeQuantity(1));
        this.elements.quantityInput.addEventListener('input', () => this.updateTotalPrice());

        // WhatsApp order button
        this.elements.whatsappOrderBtn.addEventListener('click', () => this.sendWhatsAppOrder());
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showLoading() {
        this.elements.loading.style.display = 'block';
        this.elements.errorMessage.style.display = 'none';
        this.elements.productsGrid.innerHTML = '';
        this.elements.noProducts.style.display = 'none';
    }

    hideLoading() {
        this.elements.loading.style.display = 'none';
    }

    showError(message) {
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.style.display = 'block';
        this.hideLoading();
    }

    async fetchProducts() {
        this.showLoading();
        
        try {
            const response = await fetch(this.config.googleSheetUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvData = await response.text();
            this.state.allProducts = this.parseCSV(csvData);
            
            if (this.state.allProducts.length === 0) {
                throw new Error('No products found in the spreadsheet');
            }
            
            this.initializeFilters();
            this.applyFilters();
            this.hideLoading();
            
        } catch (error) {
            console.error('Error fetching products:', error);
            this.showError(`Failed to load products: ${error.message}`);
        }
    }

    parseCSV(csvData) {
        const lines = csvData.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => 
            h.trim().toLowerCase().replace(/["\s]/g, '_')
        );

        const products = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Handle CSV parsing with proper quote handling
            const values = this.parseCSVLine(line);
            
            if (values.length > 0) {
                const product = {};
                headers.forEach((header, index) => {
                    product[header] = values[index] ? values[index].trim().replace(/^"|"$/g, '') : '';
                });

                // Validate required fields
                if (product.product_name && (product.regular_price || product.price)) {
                    // Normalize price fields
                    if (!product.regular_price && product.price) {
                        product.regular_price = product.price;
                    }
                    
                    // Parse prices as numbers
                    product.regular_price = parseFloat(product.regular_price) || 0;
                    product.sale_price = parseFloat(product.sale_price) || 0;
                    
                    products.push(product);
                }
            }
        }
        
        return products;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    initializeFilters() {
        // Populate categories
        const categories = [...new Set(this.state.allProducts
            .map(p => p.category)
            .filter(Boolean)
        )].sort();
        
        this.elements.categoryFilter.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            this.elements.categoryFilter.appendChild(option);
        });

        // Set price range
        const prices = this.state.allProducts.map(p => 
            p.sale_price > 0 ? p.sale_price : p.regular_price
        );
        
        const minPrice = Math.floor(Math.min(...prices));
        const maxPrice = Math.ceil(Math.max(...prices));
        
        this.state.filters.priceMin = minPrice;
        this.state.filters.priceMax = maxPrice;
        
        this.elements.priceRangeMin.min = minPrice;
        this.elements.priceRangeMin.max = maxPrice;
        this.elements.priceRangeMin.value = minPrice;
        
        this.elements.priceRangeMax.min = minPrice;
        this.elements.priceRangeMax.max = maxPrice;
        this.elements.priceRangeMax.value = maxPrice;
        
        this.updatePriceRangeLabel();
    }

    handleFilterChange() {
        this.state.filters.search = this.elements.searchInput.value.toLowerCase();
        this.state.filters.category = this.elements.categoryFilter.value;
        this.state.filters.sortBy = this.elements.sortSelect.value;
        this.state.filters.inStockOnly = this.elements.stockFilter.checked;
        
        this.state.currentPage = 1;
        this.applyFilters();
    }

    handlePriceRangeChange() {
        const minVal = parseInt(this.elements.priceRangeMin.value);
        const maxVal = parseInt(this.elements.priceRangeMax.value);
        
        if (minVal >= maxVal) {
            if (this.elements.priceRangeMin === document.activeElement) {
                this.elements.priceRangeMax.value = minVal + 1;
            } else {
                this.elements.priceRangeMin.value = maxVal - 1;
            }
        }
        
        this.state.filters.priceMin = parseInt(this.elements.priceRangeMin.value);
        this.state.filters.priceMax = parseInt(this.elements.priceRangeMax.value);
        
        this.updatePriceRangeLabel();
        this.state.currentPage = 1;
        this.applyFilters();
    }

    updatePriceRangeLabel() {
        const min = this.state.filters.priceMin;
        const max = this.state.filters.priceMax;
        this.elements.priceRangeLabel.textContent = `Rs. ${min} - Rs. ${max}`;
    }

    applyFilters() {
        let filtered = [...this.state.allProducts];

        // Search filter
        if (this.state.filters.search) {
            filtered = filtered.filter(product => 
                Object.values(product).some(value => 
                    String(value).toLowerCase().includes(this.state.filters.search)
                )
            );
        }

        // Category filter
        if (this.state.filters.category) {
            filtered = filtered.filter(product => 
                product.category === this.state.filters.category
            );
        }

        // Stock filter
        if (this.state.filters.inStockOnly) {
            filtered = filtered.filter(product => this.isInStock(product));
        }

        // Price filter
        filtered = filtered.filter(product => {
            const price = product.sale_price > 0 ? product.sale_price : product.regular_price;
            return price >= this.state.filters.priceMin && price <= this.state.filters.priceMax;
        });

        // Sort
        this.sortProducts(filtered);

        this.state.filteredProducts = filtered;
        this.state.totalPages = Math.ceil(filtered.length / this.config.productsPerPage);
        
        this.updateProductCount(filtered.length);
        this.renderProducts();
        this.renderPagination();
    }

    sortProducts(products) {
        switch (this.state.filters.sortBy) {
            case 'name':
                products.sort((a, b) => a.product_name.localeCompare(b.product_name));
                break;
            case 'price-low':
                products.sort((a, b) => this.getProductPrice(a) - this.getProductPrice(b));
                break;
            case 'price-high':
                products.sort((a, b) => this.getProductPrice(b) - this.getProductPrice(a));
                break;
            case 'id':
                products.sort((a, b) => (a.product_id || '').localeCompare(b.product_id || ''));
                break;
        }
    }

    getProductPrice(product) {
        return product.sale_price > 0 ? product.sale_price : product.regular_price;
    }

    isInStock(product) {
        const stockValue = (product.in_stock || 'false').toLowerCase();
        return stockValue === 'true' || stockValue === 'yes' || stockValue === '1';
    }

    updateProductCount(count) {
        this.elements.productCount.textContent = count;
    }

    renderProducts() {
        const startIndex = (this.state.currentPage - 1) * this.config.productsPerPage;
        const endIndex = startIndex + this.config.productsPerPage;
        const pageProducts = this.state.filteredProducts.slice(startIndex, endIndex);

        if (pageProducts.length === 0) {
            this.elements.productsGrid.innerHTML = '';
            this.elements.noProducts.style.display = 'block';
            return;
        }

        this.elements.noProducts.style.display = 'none';
        this.elements.productsGrid.innerHTML = pageProducts
            .map((product, index) => this.createProductCard(product, index))
            .join('');

        // Add event listeners to order buttons
        this.elements.productsGrid.querySelectorAll('.btn-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productIndex = parseInt(e.target.dataset.productIndex);
                const product = pageProducts[productIndex];
                this.openOrderModal(product);
            });
        });
    }

    createProductCard(product, index) {
        const productName = product.product_name || 'Unknown Product';
        const productId = product.product_id || product.id || 'N/A';
        const description = product.description || 'No description available';
        const category = product.category || 'Uncategorized';
        const inStock = this.isInStock(product);

        // Handle pricing
        const regularPrice = product.regular_price || 0;
        const salePrice = product.sale_price || 0;
        const isOnSale = salePrice > 0 && salePrice < regularPrice;

        let priceHtml = '';
        if (isOnSale) {
            const savings = regularPrice - salePrice;
            const savingsPercent = Math.round((savings / regularPrice) * 100);
            priceHtml = `
                <div class="price-sale">Rs. ${salePrice.toFixed(2)}</div>
                <div class="price-original">Rs. ${regularPrice.toFixed(2)}</div>
                <div class="price-savings">Save ${savingsPercent}%</div>
            `;
        } else {
            priceHtml = `<div class="price-regular">Rs. ${regularPrice.toFixed(2)}</div>`;
        }

        // Handle image
        let imageUrl = this.getProductImage(product);
        const fallbackImage = `https://placehold.co/400x250/6c757d/ffffff?text=${encodeURIComponent(productName)}`;

        return `
            <div class="col-xl-3 col-lg-4 col-md-6 col-sm-6">
                <div class="card product-card fade-in" style="animation-delay: ${index * 0.1}s">
                    <div class="product-image-container">
                        <img src="${imageUrl}" alt="${productName}" class="product-image" 
                             onerror="this.src='${fallbackImage}'">
                        <div class="product-badge">
                            ${isOnSale ? '<span class="badge badge-sale">Sale</span>' : ''}
                            <span class="badge ${inStock ? 'badge-stock' : 'badge-out-of-stock'}">
                                ${inStock ? 'In Stock' : 'Out of Stock'}
                            </span>
                        </div>
                    </div>
                    <div class="card-body product-body">
                        <div class="product-meta">
                            <span class="text-muted">ID: ${productId}</span>
                            <span class="badge bg-light text-dark">${category}</span>
                        </div>
                        <h5 class="product-title">${productName}</h5>
                        <p class="product-description">${description}</p>
                        <div class="price-container">
                            ${priceHtml}
                        </div>
                        <button class="btn btn-order ${!inStock ? 'disabled' : ''}" 
                                data-product-index="${index}" ${!inStock ? 'disabled' : ''}>
                            <i class="fas fa-shopping-cart me-2"></i>
                            ${inStock ? 'Order Now' : 'Out of Stock'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getProductImage(product) {
        const possibleImageFields = ['image_url', 'image', 'img', 'photo', 'picture'];
        let imageUrl = '';
        
        for (const field of possibleImageFields) {
            if (product[field] && product[field].trim()) {
                imageUrl = product[field].trim();
                break;
            }
        }
        
        return this.convertGoogleDriveUrl(imageUrl);
    }

    convertGoogleDriveUrl(url) {
        if (!url || !url.includes('drive.google.com')) return url;
        const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
            return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
        }
        return url;
    }

    renderPagination() {
        if (this.state.totalPages <= 1) {
            this.elements.pagination.innerHTML = '';
            return;
        }

        let paginationHtml = '';
        const currentPage = this.state.currentPage;
        const totalPages = this.state.totalPages;

        // Previous button
        paginationHtml += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;

        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) {
                paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
        }

        // Next button
        paginationHtml += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;

        this.elements.pagination.innerHTML = paginationHtml;

        // Add click event listeners
        this.elements.pagination.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.target.dataset.page || e.target.closest('[data-page]').dataset.page);
                if (page && page !== this.state.currentPage) {
                    this.state.currentPage = page;
                    this.renderProducts();
                    this.renderPagination();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    openOrderModal(product) {
        this.state.selectedProduct = product;
        
        // Populate modal with product data
        this.elements.modalProductImage.src = this.getProductImage(product);
        this.elements.modalProductName.textContent = product.product_name;
        this.elements.modalProductId.textContent = product.product_id || 'N/A';
        this.elements.modalProductCategory.textContent = product.category || 'Uncategorized';
        this.elements.modalProductDescription.textContent = product.description || 'No description available';
        
        // Set price display
        this.updateModalPriceDisplay();
        
        // Reset quantity
        this.elements.quantityInput.value = 1;
        this.updateTotalPrice();
        
        // Show modal
        this.elements.orderModal.show();
    }

    updateModalPriceDisplay() {
        const product = this.state.selectedProduct;
        const regularPrice = product.regular_price || 0;
        const salePrice = product.sale_price || 0;
        const isOnSale = salePrice > 0 && salePrice < regularPrice;

        let priceHtml = '';
        if (isOnSale) {
            const savings = regularPrice - salePrice;
            const savingsPercent = Math.round((savings / regularPrice) * 100);
            priceHtml = `
                <span class="text-danger fw-bold">Rs. ${salePrice.toFixed(2)}</span>
                <span class="text-muted text-decoration-line-through ms-2">Rs. ${regularPrice.toFixed(2)}</span>
                <span class="badge bg-success ms-2">Save ${savingsPercent}%</span>
            `;
        } else {
            priceHtml = `<span class="text-primary fw-bold">Rs. ${regularPrice.toFixed(2)}</span>`;
        }

        this.elements.modalPriceDisplay.innerHTML = priceHtml;
    }

    changeQuantity(delta) {
        const currentQuantity = parseInt(this.elements.quantityInput.value);
        const newQuantity = Math.max(1, Math.min(99, currentQuantity + delta));
        this.elements.quantityInput.value = newQuantity;
        this.updateTotalPrice();
    }

    updateTotalPrice() {
        const quantity = parseInt(this.elements.quantityInput.value) || 1;
        const product = this.state.selectedProduct;
        const price = product.sale_price > 0 ? product.sale_price : product.regular_price;
        const total = price * quantity;
        
        this.elements.modalTotalPrice.textContent = `Rs. ${total.toFixed(2)}`;
    }

    sendWhatsAppOrder() {
        const product = this.state.selectedProduct;
        const quantity = parseInt(this.elements.quantityInput.value);
        const price = product.sale_price > 0 ? product.sale_price : product.regular_price;
        const total = price * quantity;

        const message = `🛍️ *New Order Request*\n\n` +
            `📦 *Product:* ${product.product_name}\n` +
            `🆔 *Product ID:* ${product.product_id || 'N/A'}\n` +
            `🔢 *Quantity:* ${quantity}\n` +
            `💰 *Unit Price:* Rs. ${price.toFixed(2)}\n` +
            `💵 *Total Amount:* Rs. ${total.toFixed(2)}\n\n` +
            `Please confirm availability and delivery details. Thank you!`;

        const whatsappUrl = `https://wa.me/${this.config.whatsappNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        // Close modal
        this.elements.orderModal.hide();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProductCatalog();
});