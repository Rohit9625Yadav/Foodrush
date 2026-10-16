/**
 * FoodRush - Menu Page Logic (menu.js)
 * Live search by dish/restaurant name, category filtering, restaurant filtering, offer/veg filters, price sorting, and food card rendering with offers & restaurant names
 */

document.addEventListener('DOMContentLoaded', () => {
    initMenuPage();
});

let currentCategory = 'all';
let currentRestaurant = 'all';
let currentSearchQuery = '';
let currentSortBy = 'default';
let currentVegOnly = false;
let currentOffersOnly = false;

function initMenuPage() {
    const grid = document.getElementById('menu-food-grid');
    if (!grid) return;

    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    const restParam = urlParams.get('restaurant');
    const searchParam = urlParams.get('search') || urlParams.get('q');

    if (categoryParam) {
        currentCategory = categoryParam.toLowerCase();
    }
    if (restParam) {
        currentRestaurant = restParam;
    }
    if (searchParam) {
        currentSearchQuery = searchParam;
    }

    populateRestaurantFilterDropdown();

    // Setup Category Pill buttons
    const filterButtons = document.querySelectorAll('.filter-pill');
    filterButtons.forEach(btn => {
        const cat = btn.getAttribute('data-category');
        if (cat && cat.toLowerCase() === currentCategory.toLowerCase()) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = cat || 'all';
            renderMenuGrid();
        });
    });

    // Setup Search Input with instant search
    const searchInput = document.getElementById('menu-search-input');
    if (searchInput) {
        if (currentSearchQuery) searchInput.value = currentSearchQuery;
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            renderMenuGrid();
        });
    }

    // Setup Restaurant Filter
    const restSelect = document.getElementById('menu-restaurant-filter');
    if (restSelect) {
        if (currentRestaurant !== 'all') restSelect.value = currentRestaurant;
        restSelect.addEventListener('change', (e) => {
            currentRestaurant = e.target.value;
            renderMenuGrid();
        });
    }

    // Setup Sort selector
    const sortSelect = document.getElementById('menu-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSortBy = e.target.value;
            renderMenuGrid();
        });
    }

    // Setup Veg Only & Offers Only checkboxes
    const vegCheck = document.getElementById('menu-veg-only-check');
    if (vegCheck) {
        vegCheck.addEventListener('change', (e) => {
            currentVegOnly = e.target.checked;
            renderMenuGrid();
        });
    }

    const offersCheck = document.getElementById('menu-offers-only-check');
    if (offersCheck) {
        offersCheck.addEventListener('change', (e) => {
            currentOffersOnly = e.target.checked;
            renderMenuGrid();
        });
    }

    renderMenuGrid();
}

function populateRestaurantFilterDropdown() {
    const restSelect = document.getElementById('menu-restaurant-filter');
    if (!restSelect) return;

    const restMap = new Map();
    const allItems = typeof getAllProducts === 'function' ? getAllProducts() : [];
    allItems.forEach(item => {
        if (item.restaurantId && item.restaurantName) {
            restMap.set(item.restaurantId, item.restaurantName);
        }
    });

    if (window.FoodRushStore && typeof window.FoodRushStore.getRestaurantsSync === 'function') {
        const rests = window.FoodRushStore.getRestaurantsSync() || [];
        rests.forEach(r => {
            if (r.id && r.name) restMap.set(r.id, r.name);
        });
    }

    let optionsHtml = `<option value="all">🏪 All Restaurants (${restMap.size})</option>`;
    restMap.forEach((name, id) => {
        optionsHtml += `<option value="${id}">${name}</option>`;
    });
    restSelect.innerHTML = optionsHtml;
}

function renderMenuGrid() {
    const grid = document.getElementById('menu-food-grid');
    const countDisplay = document.getElementById('menu-items-count');
    const resetBtn = document.getElementById('menu-reset-btn');
    if (!grid) return;

    let items = searchProducts(
        currentSearchQuery,
        currentCategory,
        currentRestaurant,
        currentOffersOnly,
        currentVegOnly
    );

    // Apply Sorting
    if (currentSortBy === 'price-low') {
        items.sort((a, b) => a.price - b.price);
    } else if (currentSortBy === 'price-high') {
        items.sort((a, b) => b.price - a.price);
    } else if (currentSortBy === 'rating') {
        items.sort((a, b) => b.rating - a.rating);
    }

    const isFiltered = currentCategory !== 'all' || currentRestaurant !== 'all' || currentSearchQuery.trim() !== '' || currentVegOnly || currentOffersOnly;
    if (resetBtn) {
        resetBtn.style.display = isFiltered ? 'inline-flex' : 'none';
    }

    if (countDisplay) {
        const queryNote = currentSearchQuery.trim() ? ` matching "${currentSearchQuery.trim()}"` : '';
        countDisplay.innerHTML = `Showing <strong>${items.length}</strong> delicious dishes${queryNote}`;
    }

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="no-results-box">
                <i class="fa-solid fa-utensils"></i>
                <h3>No matching dishes found</h3>
                <p style="color: var(--text-muted); margin-bottom: 20px;">We couldn't find any dishes matching "${currentSearchQuery || currentCategory}".</p>
                <button type="button" class="btn btn-primary btn-sm" onclick="resetMenuFilters()">Reset Filters & View Full Menu</button>
            </div>
        `;
        return;
    }

    const fallbackImg = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80';

    grid.innerHTML = items.map(product => {
        const discountPct = (product.originalPrice && product.originalPrice > product.price)
            ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
            : 0;
        const offerBannerText = product.offerText || (discountPct > 0 ? `${discountPct}% OFF • Use FOODRUSH20` : '20% OFF • Use FOODRUSH20');
        const restName = product.restaurantName || 'FoodRush Signature Kitchen';
        const restLink = product.restaurantId ? `/restaurants/?id=${encodeURIComponent(product.restaurantId)}` : '/restaurants/';

        return `
            <div class="food-card">
                <div class="food-img-wrap">
                    ${product.badge ? `<span class="badge badge-primary card-badge">${product.badge}</span>` : ''}
                    <button type="button" class="card-favorite-btn" onclick="toggleFavoriteCard(this)" title="Save to favorites">
                        <i class="fa-regular fa-heart"></i>
                    </button>
                    <a href="/food-details/?id=${product.id}">
                        <img src="${product.image}" alt="${product.name}" class="food-img" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}';">
                    </a>
                    <div class="food-card-offer-strip">
                        <i class="fa-solid fa-tag"></i>
                        <span>${offerBannerText}</span>
                    </div>
                </div>
                <div class="food-card-body">
                    <div class="food-rest-tag">
                        <a href="${restLink}" title="View ${restName} Menu">
                            <i class="fa-solid fa-store"></i> ${restName}
                        </a>
                        <span class="veg-dot-badge ${product.isVeg ? 'veg' : 'nonveg'}">
                            ${product.isVeg ? '● Veg' : '▲ Non-Veg'}
                        </span>
                    </div>
                    <div class="food-rating-wrap">
                        <span class="rating-badge">
                            <i class="fa-solid fa-star"></i> ${product.rating}
                        </span>
                        <span class="prep-time">
                            <i class="fa-regular fa-clock"></i> ${product.prepTime}
                        </span>
                    </div>
                    <h3 class="food-title">
                        <a href="/food-details/?id=${product.id}">${product.name}</a>
                    </h3>
                    <p class="food-desc">${product.description}</p>
                    <div class="food-card-footer">
                        <div class="food-price-wrap">
                            <span class="current-price">₹${product.price}</span>
                            ${product.originalPrice ? `<span class="original-price">₹${product.originalPrice}</span>` : ''}
                        </div>
                        <div class="card-btn-group">
                            <a href="/food-details/?id=${product.id}" class="btn-card-details">Details</a>
                            <button type="button" class="btn-card-add" onclick="addToCart('${product.id}', 1)" title="Add to Cart">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function resetMenuFilters() {
    currentCategory = 'all';
    currentRestaurant = 'all';
    currentSearchQuery = '';
    currentVegOnly = false;
    currentOffersOnly = false;
    currentSortBy = 'default';

    const searchInput = document.getElementById('menu-search-input');
    const restSelect = document.getElementById('menu-restaurant-filter');
    const sortSelect = document.getElementById('menu-sort-select');
    const vegCheck = document.getElementById('menu-veg-only-check');
    const offersCheck = document.getElementById('menu-offers-only-check');

    if (searchInput) searchInput.value = '';
    if (restSelect) restSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'default';
    if (vegCheck) vegCheck.checked = false;
    if (offersCheck) offersCheck.checked = false;

    const filterButtons = document.querySelectorAll('.filter-pill');
    filterButtons.forEach(btn => {
        if (btn.getAttribute('data-category') === 'all') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderMenuGrid();
}

function toggleFavoriteCard(button) {
    button.classList.toggle('active');
    const icon = button.querySelector('i');
    if (button.classList.contains('active')) {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        if (typeof showToast === 'function') {
            showToast('Added to your favorites!', 'primary');
        }
    } else {
        icon.classList.remove('fa-solid');
        icon.classList.add('fa-regular');
    }
}
