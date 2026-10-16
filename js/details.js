/**
 * FoodRush - Food Details Page Logic (details.js)
 * Loads product dynamically via URL ?id=..., handles ingredients, quantity, Buy Now & Related items
 */

document.addEventListener('DOMContentLoaded', () => {
    initFoodDetailsPage();
});

let currentProductQuantity = 1;
let currentLoadedProduct = null;

function initFoodDetailsPage() {
    const container = document.getElementById('food-details-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    let productId = urlParams.get('id');

    // Default to first product if not provided
    if (!productId && typeof PRODUCTS !== 'undefined' && PRODUCTS.length > 0) {
        productId = PRODUCTS[0].id;
    }

    const product = typeof getProductById === 'function' ? getProductById(productId) : null;

    if (!product) {
        container.innerHTML = `
            <div style="text-align: center; padding: 80px 20px;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3.5rem; color: var(--warning); margin-bottom: 16px;"></i>
                <h2>Product Not Found</h2>
                <p style="color: var(--text-muted); margin: 12px 0 24px;">The delicious item you are looking for might have moved.</p>
                <a href="/menu/" class="btn btn-primary">Browse Full Menu</a>
            </div>
        `;
        return;
    }

    currentLoadedProduct = product;
    currentProductQuantity = 1;

    // Update Page Title and Breadcrumb
    document.title = `${product.name} - FoodRush`;
    const breadcrumbCurrent = document.getElementById('details-breadcrumb-current');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = product.name;

    // Render Product Details Card
    container.innerHTML = `
        <div class="details-grid">
            <div class="details-img-wrap">
                ${product.badge ? `<span class="badge badge-primary card-badge" style="font-size: 0.85rem; padding: 6px 16px;">${product.badge}</span>` : ''}
                <img src="${product.image}" alt="${product.name}" class="details-main-img">
            </div>

            <div class="details-info">
                <span class="details-category"><i class="fa-solid fa-tag"></i> ${product.category}</span>
                <h1 class="details-title">${product.name}</h1>

                <div class="details-meta-row">
                    <span class="rating-badge">
                        <i class="fa-solid fa-star"></i> ${product.rating} (${product.reviewsCount} reviews)
                    </span>
                    <span class="prep-time">
                        <i class="fa-regular fa-clock"></i> ${product.prepTime}
                    </span>
                    <span class="prep-time">
                        <i class="fa-solid fa-fire-flame-curved" style="color: var(--primary);"></i> ${product.calories}
                    </span>
                </div>

                <div class="details-price-row">
                    <span class="details-price">₹${product.price}</span>
                    ${product.originalPrice ? `<span class="details-orig-price">₹${product.originalPrice}</span>` : ''}
                    ${product.originalPrice ? `<span class="badge badge-secondary" style="font-size: 0.8rem;">Save ₹${product.originalPrice - product.price}</span>` : ''}
                </div>

                <p class="details-desc">${product.description}</p>

                <div>
                    <h4 class="ingredients-title"><i class="fa-solid fa-seedling" style="color: var(--success);"></i> Key Ingredients:</h4>
                    <div class="ingredients-chips">
                        ${product.ingredients.map(ing => `<span class="ingredient-chip">${ing}</span>`).join('')}
                    </div>
                </div>

                <div class="details-actions">
                    <div class="qty-control">
                        <button type="button" class="qty-btn" onclick="changeDetailsQty(-1)">-</button>
                        <span class="qty-input" id="details-qty-val">1</span>
                        <button type="button" class="qty-btn" onclick="changeDetailsQty(1)">+</button>
                    </div>

                    <button type="button" class="btn btn-primary" onclick="handleDetailsAddToCart()" style="flex: 1; min-width: 160px;">
                        <i class="fa-solid fa-cart-plus"></i> Add to Cart
                    </button>

                    <button type="button" class="btn btn-secondary" onclick="handleDetailsBuyNow()" style="flex: 1; min-width: 140px;">
                        <i class="fa-solid fa-bolt"></i> Buy Now
                    </button>
                </div>
            </div>
        </div>
    `;

    // Render Related Products (4 items)
    renderRelatedProducts(product.id, product.category);
}

function changeDetailsQty(delta) {
    currentProductQuantity += delta;
    if (currentProductQuantity < 1) currentProductQuantity = 1;
    const qtyEl = document.getElementById('details-qty-val');
    if (qtyEl) qtyEl.textContent = currentProductQuantity;
}

function handleDetailsAddToCart() {
    if (!currentLoadedProduct) return;
    addToCart(currentLoadedProduct.id, currentProductQuantity, true);
}

function handleDetailsBuyNow() {
    if (!currentLoadedProduct) return;
    addToCart(currentLoadedProduct.id, currentProductQuantity, false);

    if (window.FoodRushAuth && typeof window.FoodRushAuth.requireAuth === 'function') {
        const isAuth = window.FoodRushAuth.requireAuth('buy_now', { productId: currentLoadedProduct.id, quantity: currentProductQuantity }, () => {
            window.location.href = '/checkout/';
        });
        if (isAuth) {
            window.location.href = '/checkout/';
        }
    } else {
        window.location.href = '/checkout/';
    }
}

function renderRelatedProducts(currentId, category) {
    const grid = document.getElementById('related-products-grid');
    if (!grid || typeof getRelatedProducts !== 'function') return;

    const related = getRelatedProducts(currentId, category, 4);

    grid.innerHTML = related.map(prod => `
        <div class="food-card">
            <div class="food-img-wrap">
                ${prod.badge ? `<span class="badge badge-primary card-badge">${prod.badge}</span>` : ''}
                <a href="/food-details/?id=${prod.id}">
                    <img src="${prod.image}" alt="${prod.name}" class="food-img" loading="lazy">
                </a>
            </div>
            <div class="food-card-body">
                <div class="food-rating-wrap">
                    <span class="rating-badge"><i class="fa-solid fa-star"></i> ${prod.rating}</span>
                    <span class="prep-time"><i class="fa-regular fa-clock"></i> ${prod.prepTime}</span>
                </div>
                <h3 class="food-title">
                    <a href="/food-details/?id=${prod.id}">${prod.name}</a>
                </h3>
                <p class="food-desc">${prod.description}</p>
                <div class="food-card-footer">
                    <div class="food-price-wrap">
                        <span class="current-price">₹${prod.price}</span>
                    </div>
                    <div class="card-btn-group">
                        <a href="/food-details/?id=${prod.id}" class="btn-card-details">Details</a>
                        <button type="button" class="btn-card-add" onclick="addToCart('${prod.id}', 1)" title="Add to Cart">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}
