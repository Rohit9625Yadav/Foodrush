/**
 * FoodRush - Restaurant Directory, Detail View & Homepage Offers/Stores Renderer
 * Instant 0ms synchronous boot from local seed/cache + background Firestore sync
 */

import { FoodRushStore } from './store-data.js';

let allRestaurants = [];
let allOffers = [];
let activeCuisine = 'all';
let activeSingleMenuCategory = 'all';
let currentSingleRestaurant = null;
let controlsInitialized = false;

const FALLBACK_FOOD_IMG = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80';

function bootRestaurantsPage() {
    // 1. Load synchronously (0ms) so UI and filters work immediately on desktop & mobile
    allRestaurants = FoodRushStore.getRestaurantsSync() || [];
    allOffers = FoodRushStore.getOffersSync() || [];

    const params = new URLSearchParams(window.location.search);
    const restId = params.get('id');
    const cuisineParam = params.get('cuisine');

    if (cuisineParam) {
        activeCuisine = cuisineParam;
    }

    setupDirectoryControls();

    if (restId && document.getElementById('restaurant-detail-view')) {
        renderSingleRestaurantPage(restId);
    } else {
        refreshRestaurantViews();
    }

    // 2. Sync with Firestore in background without blocking buttons or filters
    Promise.all([
        FoodRushStore.getRestaurants(),
        FoodRushStore.getOffers()
    ]).then(([restaurants, offers]) => {
        if (Array.isArray(restaurants) && restaurants.length > 0) {
            allRestaurants = restaurants;
        }
        if (Array.isArray(offers) && offers.length > 0) {
            allOffers = offers;
        }
        populateRestaurantNameDropdown();
        refreshRestaurantViews();
    }).catch(err => {
        console.warn('[FoodRush Restaurants] Using local store data:', err.message);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRestaurantsPage);
} else {
    bootRestaurantsPage();
}

window.addEventListener('foodrush:locationChanged', () => {
    refreshRestaurantViews();
});

function refreshRestaurantViews() {
    const params = new URLSearchParams(window.location.search);
    const restId = params.get('id');

    updateLocationSubtext();

    if (restId && document.getElementById('restaurant-detail-view')) {
        renderSingleRestaurantPage(restId);
    } else if (document.getElementById('restaurants-grid-container')) {
        renderRestaurantsDirectory();
    }

    if (document.getElementById('home-restaurants-grid')) {
        renderHomeRestaurantsSection();
    }
    if (document.getElementById('home-offers-grid')) {
        renderHomeOffersSection();
    }
}

function updateLocationSubtext() {
    const loc = FoodRushStore.getActiveLocation();
    const subtextEl = document.getElementById('rest-location-subtext');
    const headingEl = document.getElementById('rest-page-heading');
    if (!subtextEl) return;

    if (loc && (loc.pincode || loc.area)) {
        if (headingEl) {
            headingEl.textContent = activeCuisine && activeCuisine !== 'all'
                ? `${activeCuisine} Restaurants & Dishes Near You`
                : `Restaurants Delivering to ${loc.area || loc.city || loc.pincode}`;
        }
        subtextEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10B981;"></i> Showing partner stores & menus for <strong>${loc.label || 'Selected Location'}: ${loc.area ? loc.area + ', ' : ''}${loc.city || ''} ${loc.pincode ? '(' + loc.pincode + ')' : ''}</strong>`;
    } else {
        if (headingEl) {
            headingEl.textContent = activeCuisine && activeCuisine !== 'all'
                ? `Best ${activeCuisine} Restaurants & Menu Dishes`
                : 'Top Restaurants Near You';
        }
        subtextEl.textContent = 'Explore verified partner restaurants, filter by cuisine (Burger, Pizza, Biryani, Indian, Chinese, Cafe, Bakery), and order with live offers.';
    }
}

/**
 * Create a Swiggy-inspired Restaurant Card HTML with prominent Restaurant Name, Offer Banner, and Top Dishes preview
 */
export function createRestaurantCardHTML(rest, searchHighlight = '') {
    const activeLocation = FoodRushStore.getActiveLocation();
    const delivStatus = FoodRushStore.checkRestaurantDeliverability(rest, activeLocation);
    const openStatus = FoodRushStore.checkRestaurantOpenStatus(rest);

    const restOffers = allOffers.filter(o =>
        (o.active !== false && o.isActive !== false) &&
        (o.restaurantId === 'ALL' || o.applicableRestaurantId === 'all' || o.restaurantId === rest.id || o.applicableRestaurantId === rest.id)
    );
    const topOfferText = rest.offerBanner || rest.offerText || (restOffers.length > 0 ? `${restOffers[0].title} • Use ${restOffers[0].code}` : '20% OFF • Use FOODRUSH20');

    const feeDisplay = delivStatus.deliveryFee === 0 ? 'FREE Delivery' : `₹${Number(delivStatus.deliveryFee || 25)} Delivery`;
    const distanceBadge = delivStatus.distanceKm !== null ? ` • ${delivStatus.distanceKm} km` : '';

    const isUnavailable = !openStatus.isOpen;

    const menuList = Array.isArray(rest.menu) ? rest.menu : [];
    let previewDishes = menuList.slice(0, 3).map(m => m.name).join(', ');
    if (searchHighlight) {
        const matchedDishes = menuList.filter(m => (m.name || '').toLowerCase().includes(searchHighlight.toLowerCase()));
        if (matchedDishes.length > 0) {
            previewDishes = matchedDishes.map(m => `${m.name} (₹${m.price})`).join(', ');
        }
    }

    return `
        <article class="restaurant-card ${isUnavailable ? 'rest-unavailable' : ''}" onclick="window.location.href='/restaurants/?id=${encodeURIComponent(rest.id)}'">
            <div class="rest-card-media">
                <img src="${rest.coverImage || rest.image || FALLBACK_FOOD_IMG}" alt="${rest.name}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_FOOD_IMG}';">
                <div class="rest-card-gradient"></div>

                <!-- Open / Closed Pill -->
                <span class="rest-status-pill ${openStatus.isOpen ? 'status-open' : 'status-closed'}">
                    <i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i> ${openStatus.label}
                </span>

                <!-- Delivery Time Pill -->
                <span class="rest-time-pill">
                    <i class="fa-solid fa-bolt" style="color: var(--primary);"></i> ${delivStatus.estimatedTime !== 'Out of range' && delivStatus.estimatedTime !== 'Not serviceable' ? delivStatus.estimatedTime : (rest.deliveryTime || '25-30 mins')}
                </span>

                <!-- Restaurant Logo Avatar -->
                <img src="${rest.logo || rest.coverImage || FALLBACK_FOOD_IMG}" alt="${rest.name} Logo" class="rest-logo-avatar" onerror="this.onerror=null;this.src='${FALLBACK_FOOD_IMG}';">

                <!-- Swiggy-style Bottom Offer Banner on Image -->
                <div class="rest-offer-strip">
                    <i class="fa-solid fa-percent"></i>
                    <span>${topOfferText}</span>
                </div>
            </div>

            <div class="rest-card-body">
                <div class="rest-card-header-row">
                    <h3 class="rest-card-title">
                        <i class="fa-solid fa-store" style="color: var(--primary); font-size: 0.95rem; margin-right: 4px;"></i>${rest.name}
                    </h3>
                    <div class="rest-rating-badge">
                        <i class="fa-solid fa-star"></i>
                        <span>${Number(rest.rating || 4.5).toFixed(1)}</span>
                    </div>
                </div>

                <div class="rest-cuisines-row">
                    <span>${Array.isArray(rest.cuisines) ? rest.cuisines.join(', ') : (rest.cuisine || 'Multi-Cuisine')}</span>
                    <span class="rest-cost-two">• ₹${rest.priceForTwo || 350} for two</span>
                </div>

                ${previewDishes ? `
                <div style="font-size: 0.8rem; color: var(--text-main); background: #FFF7F4; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <i class="fa-solid fa-utensils" style="color: var(--primary); margin-right: 4px;"></i> <strong>Dishes:</strong> ${previewDishes}
                </div>` : ''}

                <div class="rest-location-row">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>${rest.area ? rest.area + ', ' : ''}${rest.city || 'New Delhi'} (${rest.pincode || ''})${distanceBadge}</span>
                </div>

                <div class="rest-hours-row">
                    <i class="fa-regular fa-clock"></i>
                    <span>Hours: ${openStatus.hoursText}</span>
                </div>

                <div class="rest-card-footer">
                    <span class="rest-delivery-fee ${delivStatus.deliveryFee === 0 ? 'free-deliv' : ''}">
                        <i class="fa-solid fa-motorcycle"></i> ${feeDisplay}
                    </span>

                    <span class="rest-view-menu-link">
                        View Full Menu (${menuList.length}) <i class="fa-solid fa-arrow-right"></i>
                    </span>
                </div>
            </div>
        </article>
    `;
}

function populateRestaurantNameDropdown() {
    const nameSelect = document.getElementById('rest-name-select');
    if (!nameSelect) return;
    const currentVal = nameSelect.value || 'all';
    const activeRests = allRestaurants.filter(r => r.active !== false);
    nameSelect.innerHTML = `<option value="all">🏪 All Restaurant Names (${activeRests.length})</option>` +
        activeRests.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    if ([...nameSelect.options].some(o => o.value === currentVal)) {
        nameSelect.value = currentVal;
    }
}

function setupDirectoryControls() {
    populateRestaurantNameDropdown();

    const pillsBar = document.getElementById('cuisine-pills-bar');
    if (pillsBar) {
        // Sync active class with activeCuisine
        pillsBar.querySelectorAll('.filter-pill').forEach(btn => {
            const pillCuisine = (btn.dataset.cuisine || 'all').trim();
            if (pillCuisine.toLowerCase() === activeCuisine.toLowerCase()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    if (controlsInitialized) return;
    controlsInitialized = true;

    if (pillsBar) {
        pillsBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-pill');
            if (!btn) return;
            pillsBar.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCuisine = (btn.dataset.cuisine || 'all').trim();

            // Reset restaurant dropdown if user clicks a cuisine pill so it doesn't conflict
            const nameSelect = document.getElementById('rest-name-select');
            if (nameSelect && nameSelect.value !== 'all') {
                nameSelect.value = 'all';
            }

            updateLocationSubtext();
            renderRestaurantsDirectory();
        });
    }

    const nameSelect = document.getElementById('rest-name-select');
    const searchInput = document.getElementById('rest-search-input');
    const ratingFilter = document.getElementById('rest-rating-filter');
    const sortSelect = document.getElementById('rest-sort-select');
    const offersCheck = document.getElementById('rest-offers-only-check');

    if (nameSelect) nameSelect.addEventListener('change', renderRestaurantsDirectory);
    if (searchInput) searchInput.addEventListener('input', renderRestaurantsDirectory);
    if (ratingFilter) ratingFilter.addEventListener('change', renderRestaurantsDirectory);
    if (sortSelect) sortSelect.addEventListener('change', renderRestaurantsDirectory);
    if (offersCheck) offersCheck.addEventListener('change', renderRestaurantsDirectory);
}

/**
 * Helper to check if a cuisine / category matches (handles singular/plural and related categories)
 */
function matchesCuisineFilter(targetCuisine, itemCategories) {
    if (!targetCuisine || targetCuisine.toLowerCase() === 'all') return true;
    const t = targetCuisine.toLowerCase().trim();

    return itemCategories.some(rawCat => {
        const c = String(rawCat || '').toLowerCase().trim();
        if (!c) return false;
        if (c === t || c.includes(t) || t.includes(c)) return true;
        if (t === 'burger' && (c === 'burgers' || c === 'burger' || c === 'fast food')) return true;
        if (t === 'fast food' && (c === 'burger' || c === 'burgers' || c === 'fries' || c === 'chicken' || c === 'sandwich' || c === 'pizza')) return true;
        if (t === 'cafe' && (c === 'drinks' || c === 'bakery' || c === 'desserts')) return true;
        if (t === 'bakery' && (c === 'desserts' || c === 'cafe' || c === 'waffle')) return true;
        if (t === 'indian' && c === 'biryani') return true;
        return false;
    });
}

function renderRestaurantsDirectory() {
    const grid = document.getElementById('restaurants-grid-container');
    const emptyState = document.getElementById('restaurants-empty-state');
    if (!grid) return;

    if (!allRestaurants || allRestaurants.length === 0) {
        allRestaurants = FoodRushStore.getRestaurantsSync() || [];
    }

    const searchQuery = (document.getElementById('rest-search-input')?.value || '').trim().toLowerCase();
    const selectedRestId = document.getElementById('rest-name-select')?.value || 'all';
    const minRating = parseFloat(document.getElementById('rest-rating-filter')?.value || '0');
    const sortBy = document.getElementById('rest-sort-select')?.value || 'recommended';
    const offersOnly = document.getElementById('rest-offers-only-check')?.checked || false;
    const activeLocation = FoodRushStore.getActiveLocation();

    let filtered = allRestaurants.filter(r => r.active !== false);

    // 1. Restaurant Name Dropdown Filter
    if (selectedRestId && selectedRestId !== 'all') {
        filtered = filtered.filter(r => r.id === selectedRestId);
    }

    // 2. Cuisine Filter (Matches restaurant cuisines OR any dish category in its menu)
    if (activeCuisine && activeCuisine !== 'all') {
        filtered = filtered.filter(r => {
            const cuisines = Array.isArray(r.cuisines) ? r.cuisines : [r.cuisine || ''];
            const menuCats = Array.isArray(r.menu) ? r.menu.map(m => m.category || '') : [];
            return matchesCuisineFilter(activeCuisine, [...cuisines, ...menuCats]);
        });
    }

    // 3. Search Query (Restaurant name, cuisine, or dish in menu)
    if (searchQuery) {
        const matchFn = (r) => {
            const words = searchQuery.split(/\s+/).filter(Boolean);
            const searchable = [
                r.name || '',
                Array.isArray(r.cuisines) ? r.cuisines.join(' ') : '',
                r.area || '',
                r.city || '',
                r.pincode || '',
                Array.isArray(r.menu) ? r.menu.map(m => `${m.name} ${m.category}`).join(' ') : ''
            ].join(' ').toLowerCase();
            return words.every(w => searchable.includes(w));
        };

        let matched = filtered.filter(matchFn);
        if (matched.length === 0 && activeCuisine !== 'all') {
            matched = allRestaurants.filter(r => r.active !== false).filter(matchFn);
        }
        filtered = matched;
    }

    // 4. Rating Filter
    if (minRating > 0) {
        filtered = filtered.filter(r => Number(r.rating || 0) >= minRating);
    }

    // 5. Offers Filter
    if (offersOnly) {
        filtered = filtered.filter(r => {
            if (r.offerBanner || r.offerText) return true;
            return allOffers.some(o => (o.active !== false && o.isActive !== false) && (o.restaurantId === r.id || o.applicableRestaurantId === r.id));
        });
    }

    // 6. Location Deliverability Annotation (Never hide all restaurants if user's GPS is in another city!)
    const annotated = filtered.map(r => {
        const deliv = FoodRushStore.checkRestaurantDeliverability(r, activeLocation);
        return { rest: r, deliv };
    });

    let serviceableList = annotated;
    if (activeLocation) {
        const strictlyServiceable = annotated.filter(item => item.deliv.deliverable);
        // Only restrict to strictlyServiceable if at least 1 matching restaurant is in that PIN/radius; otherwise show all matching restaurants so filters always work!
        if (strictlyServiceable.length > 0) {
            serviceableList = strictlyServiceable;
        }
    }

    // 7. Sorting
    serviceableList.sort((a, b) => {
        if (sortBy === 'rating') {
            return Number(b.rest.rating || 0) - Number(a.rest.rating || 0);
        }
        if (sortBy === 'delivery_time') {
            const tA = parseInt(a.rest.deliveryTime) || 30;
            const tB = parseInt(b.rest.deliveryTime) || 30;
            return tA - tB;
        }
        if (sortBy === 'price_low') {
            return Number(a.rest.priceForTwo || 350) - Number(b.rest.priceForTwo || 350);
        }
        if (sortBy === 'delivery_fee') {
            return Number(a.deliv.deliveryFee || 0) - Number(b.deliv.deliveryFee || 0);
        }
        if (Boolean(b.rest.featured) !== Boolean(a.rest.featured)) {
            return b.rest.featured ? 1 : -1;
        }
        return Number(b.rest.rating || 0) - Number(a.rest.rating || 0);
    });

    if (serviceableList.length === 0) {
        grid.innerHTML = '';
        const dishesSec = document.getElementById('restaurants-matching-dishes-section');
        if (dishesSec) dishesSec.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            const titleEl = document.getElementById('rest-empty-title');
            const descEl = document.getElementById('rest-empty-desc');
            titleEl.textContent = 'No Matching Restaurants Found';
            descEl.textContent = 'Try clearing your search query or choosing a different cuisine filter.';
        }
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    grid.innerHTML = serviceableList.map(item => createRestaurantCardHTML(item.rest, searchQuery)).join('');

    // 8. Also render Matching Dishes (Burgers, Pizzas, Biryanis, Indian, Chinese, etc.) with Images & Offers right below!
    renderMatchingDishesForDirectory(serviceableList.map(i => i.rest), activeCuisine, searchQuery);
}

/**
 * Render Matching Food Dishes (with Images, Offers, Restaurant Name & Add to Cart) on restaurants.html
 * so clicking Burger, Pizza, Biryani, Indian, Chinese, Cafe, Bakery, or Fast Food shows all dishes immediately!
 */
function renderMatchingDishesForDirectory(matchingRestaurants, cuisineFilter, searchQuery) {
    const sectionEl = document.getElementById('restaurants-matching-dishes-section');
    const gridEl = document.getElementById('restaurants-matching-dishes-grid');
    const headingEl = document.getElementById('matching-dishes-heading');
    const subtitleEl = document.getElementById('matching-dishes-subtitle');
    if (!sectionEl || !gridEl) return;

    // Collect all dishes from matching restaurants
    let dishes = [];
    matchingRestaurants.forEach(rest => {
        if (Array.isArray(rest.menu)) {
            rest.menu.forEach(item => {
                dishes.push({
                    ...item,
                    restaurantId: rest.id,
                    restaurantName: rest.name,
                    restOfferText: rest.offerText || rest.offerBanner || '20% OFF • Use FOODRUSH20',
                    restOfferCode: rest.offerCode || 'FOODRUSH20',
                    prepTime: rest.deliveryTime || '20-25 mins',
                    rating: rest.rating || 4.8
                });
            });
        }
    });

    // Filter dishes by selected cuisine pill if not 'all'
    if (cuisineFilter && cuisineFilter !== 'all') {
        const catFiltered = dishes.filter(d => matchesCuisineFilter(cuisineFilter, [d.category]));
        if (catFiltered.length > 0) {
            dishes = catFiltered;
        }
    }

    // Filter dishes by search query if typed
    if (searchQuery) {
        const words = searchQuery.split(/\s+/).filter(Boolean);
        const queryFiltered = dishes.filter(d => {
            const text = `${d.name || ''} ${d.category || ''} ${d.restaurantName || ''}`.toLowerCase();
            return words.every(w => text.includes(w));
        });
        if (queryFiltered.length > 0) {
            dishes = queryFiltered;
        }
    }

    if (dishes.length === 0) {
        sectionEl.style.display = 'none';
        return;
    }

    sectionEl.style.display = 'block';
    if (headingEl) {
        if (searchQuery) {
            headingEl.textContent = `Matching Menu Dishes for "${searchQuery}" (${dishes.length})`;
        } else if (cuisineFilter && cuisineFilter !== 'all') {
            headingEl.textContent = `${cuisineFilter} Menu Dishes with Live Offers (${dishes.length})`;
        } else {
            headingEl.textContent = `Signature Dishes Across Partner Restaurants (${dishes.length})`;
        }
    }
    if (subtitleEl) {
        subtitleEl.textContent = cuisineFilter && cuisineFilter !== 'all'
            ? `${cuisineFilter} Specials • Direct Add to Cart`
            : 'All Partner Menus • Direct Add to Cart';
    }

    gridEl.innerHTML = dishes.map(dish => {
        const offerBanner = dish.offerText ? `${dish.offerText} • Use ${dish.restOfferCode}` : dish.restOfferText;
        const origPrice = dish.originalPrice || Math.round(Number(dish.price) * 1.2);
        return `
            <article class="food-card">
                <div class="food-img-wrap">
                    <span class="badge card-badge" style="background: ${dish.isVeg ? '#10B981' : '#EF4444'}; color: #fff;">
                        ${dish.isVeg ? '● VEG' : '▲ NON-VEG'}
                    </span>
                    <img src="${dish.image || FALLBACK_FOOD_IMG}" alt="${dish.name}" class="food-img" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_FOOD_IMG}';">
                    <div class="food-card-offer-strip">
                        <i class="fa-solid fa-tag"></i>
                        <span>${offerBanner}</span>
                    </div>
                </div>
                <div class="food-card-body">
                    <div class="food-rest-tag">
                        <a href="/restaurants/?id=${encodeURIComponent(dish.restaurantId)}" title="Open ${dish.restaurantName}">
                            <i class="fa-solid fa-store"></i> ${dish.restaurantName}
                        </a>
                        <span class="rating-badge"><i class="fa-solid fa-star"></i> ${dish.rating}</span>
                    </div>
                    <h3 class="food-title">${dish.name}</h3>
                    <p class="food-desc">${dish.description || 'Prepared fresh with signature spices and ingredients.'}</p>
                    <div class="food-card-footer">
                        <div class="food-price-wrap">
                            <span class="current-price">₹${Number(dish.price)}</span>
                            <span class="original-price">₹${origPrice}</span>
                        </div>
                        <div class="card-btn-group">
                            <button type="button" class="btn btn-primary btn-sm" onclick="addRestaurantDishToCart('${dish.restaurantId}', '${dish.id}')" style="padding: 8px 16px;">
                                <i class="fa-solid fa-plus"></i> Add
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

window.resetRestaurantFilters = function () {
    activeCuisine = 'all';
    const searchInput = document.getElementById('rest-search-input');
    const nameSelect = document.getElementById('rest-name-select');
    const ratingFilter = document.getElementById('rest-rating-filter');
    const sortSelect = document.getElementById('rest-sort-select');
    const offersCheck = document.getElementById('rest-offers-only-check');

    if (searchInput) searchInput.value = '';
    if (nameSelect) nameSelect.value = 'all';
    if (ratingFilter) ratingFilter.value = '0';
    if (sortSelect) sortSelect.value = 'recommended';
    if (offersCheck) offersCheck.checked = false;

    const pillsBar = document.getElementById('cuisine-pills-bar');
    if (pillsBar) {
        pillsBar.querySelectorAll('.filter-pill').forEach(b => {
            b.classList.toggle('active', b.dataset.cuisine === 'all');
        });
    }
    updateLocationSubtext();
    renderRestaurantsDirectory();
};

/**
 * VIEW 2: Render Single Restaurant Details & Complete Menu Page
 */
function renderSingleRestaurantPage(restId) {
    const directoryView = document.getElementById('restaurants-directory-view');
    const detailView = document.getElementById('restaurant-detail-view');
    const heroContainer = document.getElementById('single-restaurant-hero');
    const offersContainer = document.getElementById('single-restaurant-offers');

    const rest = allRestaurants.find(r => r.id === restId);
    if (!rest) {
        if (directoryView) directoryView.style.display = 'block';
        if (detailView) detailView.style.display = 'none';
        renderRestaurantsDirectory();
        return;
    }

    currentSingleRestaurant = rest;
    activeSingleMenuCategory = 'all';
    if (directoryView) directoryView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';

    const activeLocation = FoodRushStore.getActiveLocation();
    const delivStatus = FoodRushStore.checkRestaurantDeliverability(rest, activeLocation);
    const openStatus = FoodRushStore.checkRestaurantOpenStatus(rest);

    document.title = `${rest.name} - Menu & Offers | FoodRush`;

    heroContainer.innerHTML = `
        <div class="single-rest-banner">
            <div class="single-rest-hero-cover" style="background-image: url('${rest.coverImage || rest.image || FALLBACK_FOOD_IMG}');">
                <div class="single-rest-hero-overlay"></div>
                <div class="single-rest-hero-content">
                    <div class="single-rest-brand">
                        <img src="${rest.logo || rest.coverImage || FALLBACK_FOOD_IMG}" alt="${rest.name}" class="single-rest-logo" onerror="this.onerror=null;this.src='${FALLBACK_FOOD_IMG}';">
                        <div class="single-rest-title-box">
                            <div class="single-rest-title-row">
                                <h1>${rest.name}</h1>
                                <span class="rest-status-pill ${openStatus.isOpen ? 'status-open' : 'status-closed'}" style="position: static;">
                                    <i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i> ${openStatus.label}
                                </span>
                            </div>
                            <p class="single-rest-cuisines">
                                ${Array.isArray(rest.cuisines) ? rest.cuisines.join(' • ') : ''}
                            </p>
                            <p class="single-rest-addr">
                                <i class="fa-solid fa-location-dot" style="color: var(--primary);"></i> ${rest.address}, ${rest.city} - ${rest.pincode}
                                ${rest.phone ? ` <span class="rest-phone-sep">|</span> <i class="fa-solid fa-phone"></i> ${rest.phone}` : ''}
                            </p>
                        </div>
                    </div>

                    <div class="single-rest-stats-glass">
                        <div class="rest-stat-col">
                            <div class="rest-stat-val" style="color: #FBBF24;"><i class="fa-solid fa-star"></i> ${Number(rest.rating || 4.5).toFixed(1)}</div>
                            <div class="rest-stat-lbl">${rest.reviewsCount || rest.reviewCount || 150}+ ratings</div>
                        </div>
                        <div class="rest-stat-col">
                            <div class="rest-stat-val">${rest.deliveryTime || '25-30 mins'}</div>
                            <div class="rest-stat-lbl">Delivery Time</div>
                        </div>
                        <div class="rest-stat-col">
                            <div class="rest-stat-val">${delivStatus.deliveryFee === 0 ? 'FREE' : '₹' + Number(delivStatus.deliveryFee || rest.deliveryFee || 25)}</div>
                            <div class="rest-stat-lbl">Delivery Fee</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="single-rest-subbar">
                <div class="single-rest-desc-hours">
                    <span>${rest.description || ''}</span>
                    <strong class="single-rest-hours-tag">
                        <i class="fa-regular fa-clock" style="color: var(--primary);"></i> Hours: ${openStatus.hoursText}
                    </strong>
                </div>
                <div>
                    <span class="rest-serviceable-pill ok">
                        <i class="fa-solid fa-truck-fast"></i> Express Delivery Available
                    </span>
                </div>
            </div>
        </div>
    `;

    const applicableOffers = allOffers.filter(o =>
        (o.active !== false && o.isActive !== false) &&
        (o.restaurantId === 'ALL' || o.applicableRestaurantId === 'all' || o.restaurantId === rest.id || o.applicableRestaurantId === rest.id)
    );

    if (applicableOffers.length > 0) {
        offersContainer.innerHTML = `
            <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 12px;">
                <i class="fa-solid fa-tags" style="color: var(--primary);"></i> Deals & Coupons for ${rest.name}
            </h3>
            <div class="single-rest-offers-grid">
                ${applicableOffers.map(off => `
                    <div class="offer-coupon-card">
                        <div>
                            <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${off.title}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${off.description}</div>
                        </div>
                        <button type="button" class="btn btn-outline btn-sm" onclick="copyCouponCode('${off.code}')" style="white-space: nowrap; font-weight: 800; letter-spacing: 0.5px;">
                            ${off.code} <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        offersContainer.innerHTML = '';
    }

    renderSingleRestaurantCategoryPills(rest, delivStatus, openStatus);

    const menuSearch = document.getElementById('rest-menu-search');
    const vegOnly = document.getElementById('rest-menu-veg-only');
    if (menuSearch) {
        menuSearch.value = '';
        menuSearch.oninput = () => renderSingleRestaurantMenu(rest, delivStatus, openStatus);
    }
    if (vegOnly) {
        vegOnly.checked = false;
        vegOnly.onchange = () => renderSingleRestaurantMenu(rest, delivStatus, openStatus);
    }

    renderSingleRestaurantMenu(rest, delivStatus, openStatus);
}

function renderSingleRestaurantCategoryPills(rest, delivStatus, openStatus) {
    const pillsContainer = document.getElementById('single-rest-category-pills');
    if (!pillsContainer) return;

    const menuItems = Array.isArray(rest.menu) ? rest.menu : [];
    const catCounts = new Map();
    menuItems.forEach(item => {
        const cat = (item.category || 'Special').trim();
        catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    });

    let html = `<button type="button" class="filter-pill ${activeSingleMenuCategory === 'all' ? 'active' : ''}" data-menu-cat="all">All Dishes (${menuItems.length})</button>`;
    catCounts.forEach((count, cat) => {
        const isActive = activeSingleMenuCategory.toLowerCase() === cat.toLowerCase();
        html += `<button type="button" class="filter-pill ${isActive ? 'active' : ''}" data-menu-cat="${cat}">${cat} (${count})</button>`;
    });

    pillsContainer.innerHTML = html;
    pillsContainer.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            pillsContainer.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeSingleMenuCategory = btn.dataset.menuCat || 'all';
            renderSingleRestaurantMenu(rest, delivStatus, openStatus);
        });
    });
}

function renderSingleRestaurantMenu(rest, delivStatus, openStatus) {
    const menuGrid = document.getElementById('single-restaurant-menu-grid');
    if (!menuGrid) return;

    const query = (document.getElementById('rest-menu-search')?.value || '').trim().toLowerCase();
    const vegOnly = document.getElementById('rest-menu-veg-only')?.checked || false;

    let menuItems = Array.isArray(rest.menu) ? [...rest.menu] : [];

    if (activeSingleMenuCategory && activeSingleMenuCategory !== 'all') {
        menuItems = menuItems.filter(item => (item.category || '').toLowerCase() === activeSingleMenuCategory.toLowerCase());
    }

    if (query) {
        const words = query.split(/\s+/).filter(Boolean);
        let matched = menuItems.filter(item => {
            const text = `${item.name || ''} ${item.category || ''}`.toLowerCase();
            return words.every(w => text.includes(w));
        });
        if (matched.length === 0 && activeSingleMenuCategory !== 'all') {
            matched = (Array.isArray(rest.menu) ? rest.menu : []).filter(item => {
                const text = `${item.name || ''} ${item.category || ''}`.toLowerCase();
                return words.every(w => text.includes(w));
            });
        }
        menuItems = matched;
    }

    if (vegOnly) {
        menuItems = menuItems.filter(item => item.isVeg === true);
    }

    if (menuItems.length === 0) {
        menuGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #fff; border-radius: 12px; border: 1px solid var(--border-light);">
                <p style="color: var(--text-muted); margin: 0 0 12px;">No menu dishes match "${query || activeSingleMenuCategory}" in ${rest.name}.</p>
                <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('rest-menu-search').value=''; document.getElementById('rest-menu-search').dispatchEvent(new Event('input'));">Show All Dishes</button>
            </div>
        `;
        return;
    }

    const canOrder = openStatus.isOpen;

    menuGrid.innerHTML = menuItems.map(item => {
        const isAvailable = item.available !== false && canOrder;
        const itemOffer = item.offerText || rest.offerText || `Use ${rest.offerCode || 'FOODRUSH20'}`;
        const origPrice = item.originalPrice || Math.round(Number(item.price) * 1.2);

        return `
            <article class="food-card ${!isAvailable ? 'item-unavailable' : ''}">
                <div class="food-img-wrap">
                    <span class="badge card-badge" style="background: ${item.isVeg ? '#10B981' : '#EF4444'}; color: #fff;">
                        ${item.isVeg ? '● VEG' : '▲ NON-VEG'}
                    </span>
                    <img src="${item.image || rest.coverImage || FALLBACK_FOOD_IMG}" alt="${item.name}" class="food-img" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_FOOD_IMG}';">
                    <div class="food-card-offer-strip">
                        <i class="fa-solid fa-tag"></i>
                        <span>${itemOffer} • ${rest.offerCode || 'FOODRUSH20'}</span>
                    </div>
                </div>
                <div class="food-card-body">
                    <div class="food-rest-tag">
                        <span><i class="fa-solid fa-store" style="color: var(--primary);"></i> ${rest.name}</span>
                        <span class="rating-badge"><i class="fa-solid fa-utensils"></i> ${item.category || 'Special'}</span>
                    </div>
                    <h3 class="food-title">${item.name}</h3>
                    <p class="food-desc">${item.description || 'Freshly prepared with authentic ingredients.'}</p>
                    <div class="food-card-footer">
                        <div class="food-price-wrap">
                            <span class="current-price">₹${Number(item.price)}</span>
                            <span class="original-price">₹${origPrice}</span>
                        </div>
                        <div class="card-btn-group">
                            ${isAvailable ? `
                                <button type="button" class="btn btn-primary btn-sm" onclick="addRestaurantDishToCart('${rest.id}', '${item.id}')" style="padding: 8px 16px;">
                                    <i class="fa-solid fa-plus"></i> Add
                                </button>
                            ` : `
                                <button type="button" class="btn btn-sm" disabled style="opacity: 0.6; cursor: not-allowed; background: #94A3B8; color: #fff; padding: 8px 14px;">
                                    ${item.available === false ? 'Sold Out' : 'Closed'}
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

/**
 * Add a dish from a specific restaurant to the FoodRush cart
 */
window.addRestaurantDishToCart = function (restId, dishId) {
    const rest = allRestaurants.find(r => r.id === restId);
    if (!rest || !Array.isArray(rest.menu)) return;

    const dish = rest.menu.find(m => String(m.id) === String(dishId));
    if (!dish) return;

    if (typeof window.foodProducts !== 'undefined' && Array.isArray(window.foodProducts)) {
        const exists = window.foodProducts.find(p => String(p.id) === String(dish.id));
        if (!exists) {
            window.foodProducts.push({
                id: dish.id,
                name: `${dish.name}`,
                category: (dish.category || 'special').toLowerCase(),
                price: Number(dish.price),
                originalPrice: Number(dish.originalPrice || Math.round(Number(dish.price) * 1.2)),
                rating: Number(rest.rating || 4.7),
                reviews: Number(rest.reviewsCount || 150),
                prepTime: rest.deliveryTime || '25-30 min',
                calories: '450 kcal',
                isPopular: true,
                badge: rest.name,
                image: dish.image || rest.coverImage || FALLBACK_FOOD_IMG,
                description: dish.description || '',
                ingredients: [rest.name, dish.category || 'Fresh Ingredients'],
                restaurantId: rest.id,
                restaurantName: rest.name
            });
        }
    }

    localStorage.setItem('foodrush_cart_restaurant', JSON.stringify({
        id: rest.id,
        name: rest.name,
        deliveryFee: rest.deliveryFee,
        freeDeliveryAbove: rest.freeDeliveryAbove,
        deliveryTime: rest.deliveryTime
    }));

    if (typeof window.addToCart === 'function') {
        window.addToCart(dish.id, 1);
    }
};

window.copyCouponCode = function (code) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).catch(() => {});
    }
    localStorage.setItem('foodrush_pending_coupon', code);
    localStorage.setItem('foodrush_active_coupon', code);
    if (typeof window.showToast === 'function') {
        window.showToast(`Coupon ${code} copied! Apply it in your Cart or Checkout.`, 'primary');
    } else {
        alert(`Coupon ${code} copied!`);
    }
};

/**
 * Render Homepage Top Restaurants & Offers Sections (when on index.html)
 */
function renderHomeRestaurantsSection() {
    const grid = document.getElementById('home-restaurants-grid');
    if (!grid) return;

    if (!allRestaurants || allRestaurants.length === 0) {
        allRestaurants = FoodRushStore.getRestaurantsSync() || [];
    }

    let list = allRestaurants.filter(r => r.active !== false);
    grid.innerHTML = list.slice(0, 6).map(r => createRestaurantCardHTML(r)).join('');
}

function renderHomeOffersSection() {
    const grid = document.getElementById('home-offers-grid');
    if (!grid) return;

    if (!allOffers || allOffers.length === 0) {
        allOffers = FoodRushStore.getOffersSync() || [];
    }

    const now = new Date();
    const activeOffers = allOffers.filter(o => {
        if (o.active === false || o.isActive === false) return false;
        if (o.expiryDate && new Date(o.expiryDate + 'T23:59:59') < now) return false;
        return true;
    });

    if (activeOffers.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted);">No active coupons right now. Check back soon!</p>`;
        return;
    }

    grid.innerHTML = activeOffers.map(off => {
        const badgeLabel = (off.discountType === 'percentage' || off.discountType === 'first_order')
            ? `${off.discountValue}% OFF`
            : (off.discountType === 'free_delivery' ? 'FREE DELIVERY' : `₹${off.discountValue} FLAT OFF`);

        return `
            <div class="home-offer-card">
                <div class="home-offer-badge">${badgeLabel}</div>
                <h3 class="home-offer-title">${off.title}</h3>
                <p class="home-offer-desc">${off.description}</p>
                <div class="home-offer-meta">
                    <span>Min Order: ₹${Number(off.minOrderAmount || 0)}</span>
                    ${off.restaurantName && off.restaurantId !== 'ALL' ? `<span>• ${off.restaurantName}</span>` : '<span>• All Restaurants</span>'}
                </div>
                <div class="home-offer-footer">
                    <span class="coupon-code-pill">${off.code}</span>
                    <button type="button" class="btn btn-primary btn-sm" onclick="copyCouponCode('${off.code}')">
                        Copy Code
                    </button>
                </div>
            </div>
        `;
    }).join('');
}
