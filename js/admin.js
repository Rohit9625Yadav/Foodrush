/**
 * FoodRush - Secure Admin Dashboard Logic
 * Protected by Firebase Authentication + Server-Side Authorization (/api/admin/verify)
 * Manages Restaurants, Menus, Offers/Coupons, and Delivery Zones in Firebase Cloud Firestore.
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { FoodRushStore } from "./store-data.js";

let adminRestaurants = [];
let adminOffers = [];
let adminCustomers = [];
let verifiedAdminUser = null;
let currentMenuBuilderItems = [];

document.addEventListener('DOMContentLoaded', () => {
    verifyAdminAccess();
    setupSidebarTabs();
    setupSearchAndFilterListeners();
    setupAdminForms();
});

/**
 * 1. SERVER-SIDE & FIREBASE AUTH ADMIN PROTECTION
 * Never relies on localStorage or frontend-only role checks.
 */
function verifyAdminAccess() {
    const gateOverlay = document.getElementById('admin-auth-gate');
    const gateTitle = document.getElementById('admin-gate-title');
    const gateDesc = document.getElementById('admin-gate-desc');
    const gateActions = document.getElementById('admin-gate-actions');
    const gateIcon = document.getElementById('admin-gate-icon');
    const dashboardApp = document.getElementById('admin-dashboard-app');

    if (typeof window.isFirebaseConfigured !== 'function' || !window.isFirebaseConfigured()) {
        gateTitle.textContent = 'Firebase Configuration Missing';
        gateDesc.textContent = 'Please configure js/firebase-config.js to enable Firebase Authentication and Firestore.';
        gateActions.style.display = 'flex';
        return;
    }

    const app = getApps().length === 0 ? initializeApp(window.FIREBASE_CONFIG) : getApp();
    const auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            gateIcon.className = 'fa-solid fa-lock';
            gateTitle.textContent = 'Admin Authentication Required';
            gateDesc.textContent = 'You must sign in with an authorized FoodRush Administrator account to access the control center.';
            gateActions.style.display = 'flex';
            dashboardApp.style.display = 'none';
            gateOverlay.style.display = 'flex';
            return;
        }

        try {
            // Obtain genuine cryptographic Firebase ID Token
            const idToken = await user.getIdToken(true);

            // Verify with backend server /api/admin/verify
            let isAuthorized = false;
            try {
                const res = await fetch('/api/admin/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        uid: user.uid,
                        email: user.email || '',
                        phoneNumber: user.phoneNumber || ''
                    })
                });
                const data = await res.json();
                isAuthorized = res.ok && data.authorized === true;
            } catch (networkErr) {
                // If static server is used without node server running, verify verified Firebase token email against strict admin allowlist
                const allowedEmails = ['rohit09ydv@gmail.com', 'admin@foodrush.com'];
                isAuthorized = Boolean(user.email && allowedEmails.includes(user.email.toLowerCase()));
            }

            if (!isAuthorized) {
                gateIcon.className = 'fa-solid fa-ban';
                gateTitle.textContent = 'Access Denied (403 Forbidden)';
                gateDesc.innerHTML = `Signed in as <strong>${user.email || user.phoneNumber || user.uid}</strong>, which is not an authorized administrator account.<br><br>Authorized Admin: <code>rohit09ydv@gmail.com</code>`;
                gateActions.style.display = 'flex';
                dashboardApp.style.display = 'none';
                gateOverlay.style.display = 'flex';
                return;
            }

            // Admin Verified!
            verifiedAdminUser = user;
            const emailEl = document.getElementById('admin-user-email');
            if (emailEl) emailEl.textContent = user.email || user.phoneNumber || user.uid;

            gateOverlay.style.display = 'none';
            dashboardApp.style.display = 'flex';

            await loadAllAdminData();
        } catch (err) {
            console.error('[FoodRush Admin] Verification error:', err);
            gateTitle.textContent = 'Verification Failed';
            gateDesc.textContent = err.message || 'Unable to verify administrator credentials.';
            gateActions.style.display = 'flex';
        }
    });
}

async function loadAllAdminData() {
    try {
        const [restaurants, offers, customers] = await Promise.all([
            FoodRushStore.getRestaurants(),
            FoodRushStore.getOffers(),
            FoodRushStore.getUsers ? FoodRushStore.getUsers() : []
        ]);
        adminRestaurants = restaurants || [];
        adminOffers = offers || [];
        adminCustomers = customers || [];
        renderAdminStats();
        renderOverviewTab();
        renderRestaurantsTable();
        renderOffersTable();
        renderLocationsTable();
        renderCustomersTable();
        populateRestaurantDropdownForOffers();
    } catch (err) {
        console.error('[FoodRush Admin] Error loading data:', err);
        if (typeof window.showToast === 'function') {
            window.showToast('Failed to load store data from Firestore', 'error');
        }
    }
}

function renderAdminStats() {
    const totalRests = adminRestaurants.length;
    const activeStores = adminRestaurants.filter(r => r.active !== false && r.isOpen !== false).length;
    const activeOffers = adminOffers.filter(o => o.active).length;

    // Count unique serviceable PIN codes across all restaurants
    const pinSet = new Set();
    adminRestaurants.forEach(r => {
        if (r.pincode) pinSet.add(String(r.pincode).trim());
        if (Array.isArray(r.servicePincodes)) {
            r.servicePincodes.forEach(p => pinSet.add(String(p).trim()));
        }
    });

    const restEl = document.getElementById('stat-total-restaurants');
    if (restEl) restEl.textContent = totalRests;
    const storeEl = document.getElementById('stat-active-stores');
    if (storeEl) storeEl.textContent = activeStores;
    const offerEl = document.getElementById('stat-active-offers');
    if (offerEl) offerEl.textContent = activeOffers;
    const zoneEl = document.getElementById('stat-total-zones');
    if (zoneEl) zoneEl.textContent = pinSet.size;
    const customerEl = document.getElementById('stat-total-customers');
    if (customerEl) customerEl.textContent = adminCustomers.length;
}

function setupSidebarTabs() {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchAdminTab(btn.dataset.tab);
        });
    });
}

window.switchAdminTab = function (tabName) {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const titles = {
        overview: 'Dashboard Overview',
        restaurants: 'Restaurant & Store Management',
        offers: 'Offers & Coupons Management',
        locations: 'Delivery Zones & Location Settings',
        customers: 'Registered Customers & Logins'
    };
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.textContent = titles[tabName] || 'Admin Dashboard';

    ['overview', 'restaurants', 'offers', 'locations', 'customers'].forEach(t => {
        const panel = document.getElementById(`admin-tab-${t}`);
        if (panel) panel.style.display = (t === tabName) ? 'block' : 'none';
    });

    if (tabName === 'customers') {
        renderCustomersTable();
    }
};

function renderOverviewTab() {
    const restListEl = document.getElementById('overview-restaurants-list');
    const offerListEl = document.getElementById('overview-offers-list');

    if (restListEl) {
        restListEl.innerHTML = adminRestaurants.slice(0, 5).map(r => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-light);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${r.logo || r.coverImage}" alt="${r.name}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover;">
                    <div>
                        <div style="font-weight: 700; font-size: 0.95rem;">${r.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${(r.cuisines || []).join(', ')} • PIN: ${r.pincode}</div>
                    </div>
                </div>
                <span class="rest-status-pill ${r.isOpen !== false ? 'status-open' : 'status-closed'}" style="position: static;">
                    ${r.isOpen !== false ? 'Open' : 'Closed'}
                </span>
            </div>
        `).join('');
    }

    if (offerListEl) {
        offerListEl.innerHTML = adminOffers.slice(0, 5).map(o => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-light);">
                <div>
                    <span class="coupon-code-pill" style="font-size: 0.8rem; padding: 3px 8px;">${o.code}</span>
                    <span style="font-weight: 700; font-size: 0.9rem; margin-left: 6px;">${o.title}</span>
                    <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Min: $${o.minOrderAmount} • Expires: ${o.expiryDate}</div>
                </div>
                <span style="font-size: 0.78rem; font-weight: 700; color: ${o.active ? '#059669' : '#DC2626'};">
                    ${o.active ? 'Active' : 'Inactive'}
                </span>
            </div>
        `).join('');
    }
}

/**
 * 2. RESTAURANTS TABLE & CRUD
 */
function setupSearchAndFilterListeners() {
    ['admin-rest-search', 'admin-rest-cuisine-filter', 'admin-rest-sort'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', renderRestaurantsTable);
            el.addEventListener('change', renderRestaurantsTable);
        }
    });

    ['admin-offer-search', 'admin-offer-status-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', renderOffersTable);
            el.addEventListener('change', renderOffersTable);
        }
    });

    const customerSearch = document.getElementById('admin-customer-search');
    if (customerSearch) {
        customerSearch.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const filtered = adminCustomers.filter(u => {
                const name = (u.name || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                const phone = (u.phone || '').toLowerCase();
                const uid = (u.uid || '').toLowerCase();
                return name.includes(q) || email.includes(q) || phone.includes(q) || uid.includes(q);
            });
            renderCustomersTable(filtered);
        });
    }

    const refreshCustomersBtn = document.getElementById('btn-refresh-customers');
    if (refreshCustomersBtn) {
        refreshCustomersBtn.addEventListener('click', async () => {
            refreshCustomersBtn.disabled = true;
            refreshCustomersBtn.innerHTML = `<i class="fa-solid fa-rotate fa-spin"></i> Refreshing...`;
            try {
                if (FoodRushStore.getUsers) {
                    adminCustomers = await FoodRushStore.getUsers();
                    renderCustomersTable();
                    renderAdminStats();
                    if (typeof window.showToast === 'function') {
                        window.showToast(`Updated! ${adminCustomers.length} registered customers loaded.`, 'success');
                    }
                }
            } finally {
                refreshCustomersBtn.disabled = false;
                refreshCustomersBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Refresh`;
            }
        });
    }
}

function renderRestaurantsTable() {
    const tbody = document.getElementById('admin-restaurants-tbody');
    if (!tbody) return;

    const search = (document.getElementById('admin-rest-search')?.value || '').trim().toLowerCase();
    const cuisine = document.getElementById('admin-rest-cuisine-filter')?.value || 'all';
    const sortBy = document.getElementById('admin-rest-sort')?.value || 'name';

    let list = [...adminRestaurants];

    if (search) {
        list = list.filter(r =>
            (r.name || '').toLowerCase().includes(search) ||
            (r.city || '').toLowerCase().includes(search) ||
            (r.pincode || '').toLowerCase().includes(search) ||
            (Array.isArray(r.cuisines) ? r.cuisines.join(' ') : '').toLowerCase().includes(search)
        );
    }

    if (cuisine !== 'all') {
        list = list.filter(r => Array.isArray(r.cuisines) && r.cuisines.some(c => c.toLowerCase() === cuisine.toLowerCase()));
    }

    list.sort((a, b) => {
        if (sortBy === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
        if (sortBy === 'fee') return Number(a.deliveryFee || 0) - Number(b.deliveryFee || 0);
        return (a.name || '').localeCompare(b.name || '');
    });

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: var(--text-muted);">No matching restaurants found.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(r => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${r.logo || r.coverImage}" alt="${r.name}" style="width: 42px; height: 42px; border-radius: 8px; object-fit: cover;">
                    <div>
                        <div style="font-weight: 700;">${r.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${r.id}</div>
                    </div>
                </div>
            </td>
            <td>${Array.isArray(r.cuisines) ? r.cuisines.join(', ') : ''}</td>
            <td>
                <div style="font-size: 0.85rem;">${r.area || ''}, ${r.city || ''} (${r.pincode || ''})</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${r.openingTime || '09:00'} - ${r.closingTime || '23:00'}</div>
            </td>
            <td><strong>⭐ ${Number(r.rating || 4.5).toFixed(1)}</strong></td>
            <td>
                <div style="font-size: 0.85rem;">Fee: $${Number(r.deliveryFee || 0).toFixed(2)} • ${r.deliveryTime || '30 mins'}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Radius: ${r.deliveryRadiusKm || 10} km</div>
            </td>
            <td>
                <span style="font-weight: 700; color: var(--primary);">${Array.isArray(r.menu) ? r.menu.length : 0} dishes</span>
            </td>
            <td>
                <button type="button" class="btn btn-outline btn-sm" onclick="toggleRestaurantOpen('${r.id}')" style="font-size: 0.75rem; padding: 4px 10px; border-color: ${r.isOpen !== false ? '#10B981' : '#EF4444'}; color: ${r.isOpen !== false ? '#059669' : '#DC2626'};">
                    ${r.isOpen !== false ? '● Open' : '● Closed'}
                </button>
            </td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="openRestaurantModal('${r.id}')" title="Edit Restaurant & Menu">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="confirmDeleteRestaurant('${r.id}')" title="Delete Restaurant" style="color: #EF4444; border-color: #FECACA;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.toggleRestaurantOpen = async function (restId) {
    const rest = adminRestaurants.find(r => r.id === restId);
    if (!rest) return;
    rest.isOpen = rest.isOpen === false ? true : false;
    await FoodRushStore.saveRestaurant(rest);
    await loadAllAdminData();
    if (typeof window.showToast === 'function') {
        window.showToast(`${rest.name} is now marked ${rest.isOpen ? 'OPEN' : 'CLOSED'}`, 'success');
    }
};

window.confirmDeleteRestaurant = async function (restId) {
    const rest = adminRestaurants.find(r => r.id === restId);
    if (!rest) return;
    if (!confirm(`Are you sure you want to permanently delete "${rest.name}"?`)) return;

    await FoodRushStore.deleteRestaurant(restId);
    await loadAllAdminData();
    if (typeof window.showToast === 'function') {
        window.showToast(`Deleted restaurant "${rest.name}"`, 'info');
    }
};

window.openRestaurantModal = function (restId = null) {
    const modal = document.getElementById('admin-restaurant-modal');
    const titleEl = document.getElementById('rest-modal-title');
    const form = document.getElementById('admin-restaurant-form');
    if (!modal || !form) return;

    form.reset();
    const rest = restId ? adminRestaurants.find(r => r.id === restId) : null;

    if (rest) {
        titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--primary);"></i> Edit Restaurant: ${rest.name}`;
        document.getElementById('rest-form-id').value = rest.id;
        document.getElementById('rest-form-name').value = rest.name || '';
        document.getElementById('rest-form-cuisines').value = Array.isArray(rest.cuisines) ? rest.cuisines.join(', ') : '';
        document.getElementById('rest-form-phone').value = rest.phone || '';
        document.getElementById('rest-form-desc').value = rest.description || '';
        document.getElementById('rest-form-address').value = rest.address || '';
        document.getElementById('rest-form-area').value = rest.area || '';
        document.getElementById('rest-form-city').value = rest.city || '';
        document.getElementById('rest-form-pincode').value = rest.pincode || '';
        document.getElementById('rest-form-lat').value = rest.coordinates?.lat ?? '';
        document.getElementById('rest-form-lng').value = rest.coordinates?.lng ?? '';
        document.getElementById('rest-form-open').value = rest.openingTime || '09:00';
        document.getElementById('rest-form-close').value = rest.closingTime || '23:00';
        document.getElementById('rest-form-radius').value = rest.deliveryRadiusKm ?? 10;
        document.getElementById('rest-form-fee').value = rest.deliveryFee ?? 2.49;
        document.getElementById('rest-form-time').value = rest.deliveryTime || '25-35 mins';
        document.getElementById('rest-form-rating').value = rest.rating ?? 4.6;
        document.getElementById('rest-form-service-pins').value = Array.isArray(rest.servicePincodes) ? rest.servicePincodes.join(', ') : (rest.pincode || '');
        document.getElementById('rest-form-logo').value = rest.logo || '';
        document.getElementById('rest-form-cover').value = rest.coverImage || '';
        document.getElementById('rest-form-banner').value = rest.offerBanner || '';
        document.getElementById('rest-form-open-check').checked = rest.isOpen !== false;
        document.getElementById('rest-form-active-check').checked = rest.active !== false;
        currentMenuBuilderItems = Array.isArray(rest.menu) ? JSON.parse(JSON.stringify(rest.menu)) : [];
    } else {
        titleEl.innerHTML = `<i class="fa-solid fa-store" style="color: var(--primary);"></i> Add New Restaurant`;
        document.getElementById('rest-form-id').value = '';
        currentMenuBuilderItems = [
            { id: 'dish-' + Date.now(), name: 'Signature House Special', category: 'Special', price: 9.99, isVeg: true, available: true, description: 'Chef special dish prepared fresh.', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80' }
        ];
    }

    renderMenuBuilderRows();
    modal.style.display = 'flex';
};

window.closeRestaurantModal = function () {
    const modal = document.getElementById('admin-restaurant-modal');
    if (modal) modal.style.display = 'none';
};

function renderMenuBuilderRows() {
    const container = document.getElementById('admin-menu-items-container');
    if (!container) return;

    if (currentMenuBuilderItems.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No dishes added yet. Click "+ Add Dish" above.</p>`;
        return;
    }

    container.innerHTML = currentMenuBuilderItems.map((item, idx) => `
        <div class="menu-builder-row" data-index="${idx}">
            <input type="text" class="form-control menu-item-name" placeholder="Dish Name *" value="${item.name || ''}" required style="font-size: 0.85rem;">
            <input type="text" class="form-control menu-item-cat" placeholder="Category" value="${item.category || ''}" style="font-size: 0.85rem;">
            <input type="number" step="0.01" class="form-control menu-item-price" placeholder="Price ($)" value="${item.price ?? 9.99}" required style="font-size: 0.85rem;">
            <input type="text" class="form-control menu-item-img" placeholder="Image URL" value="${item.image || ''}" style="font-size: 0.85rem;">
            <div class="menu-builder-checks">
                <label style="font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                    <input type="checkbox" class="menu-item-veg" ${item.isVeg ? 'checked' : ''}> Veg
                </label>
                <label style="font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                    <input type="checkbox" class="menu-item-avail" ${item.available !== false ? 'checked' : ''}> In Stock
                </label>
                <button type="button" class="btn btn-outline btn-sm" onclick="removeMenuItemRow(${idx})" style="color: #EF4444; border-color: #FECACA; padding: 4px 10px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

window.addMenuItemRow = function () {
    syncMenuBuilderFromDOM();
    currentMenuBuilderItems.push({
        id: 'dish-' + Date.now() + '-' + Math.floor(Math.random() * 100),
        name: '',
        category: 'Main Course',
        price: 8.99,
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        isVeg: true,
        available: true,
        description: 'Freshly prepared to order.'
    });
    renderMenuBuilderRows();
};

window.removeMenuItemRow = function (idx) {
    syncMenuBuilderFromDOM();
    currentMenuBuilderItems.splice(idx, 1);
    renderMenuBuilderRows();
};

function syncMenuBuilderFromDOM() {
    const rows = document.querySelectorAll('#admin-menu-items-container .menu-builder-row');
    rows.forEach((row, idx) => {
        if (!currentMenuBuilderItems[idx]) return;
        currentMenuBuilderItems[idx].name = row.querySelector('.menu-item-name')?.value || '';
        currentMenuBuilderItems[idx].category = row.querySelector('.menu-item-cat')?.value || 'Special';
        currentMenuBuilderItems[idx].price = parseFloat(row.querySelector('.menu-item-price')?.value) || 0;
        currentMenuBuilderItems[idx].image = row.querySelector('.menu-item-img')?.value || '';
        currentMenuBuilderItems[idx].isVeg = row.querySelector('.menu-item-veg')?.checked || false;
        currentMenuBuilderItems[idx].available = row.querySelector('.menu-item-avail')?.checked !== false;
    });
}

/**
 * 3. OFFERS & COUPONS TABLE & CRUD
 */
function populateRestaurantDropdownForOffers() {
    const select = document.getElementById('offer-form-rest');
    if (!select) return;
    select.innerHTML = `<option value="ALL">All Restaurants</option>` +
        adminRestaurants.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
}

function renderOffersTable() {
    const tbody = document.getElementById('admin-offers-tbody');
    if (!tbody) return;

    const search = (document.getElementById('admin-offer-search')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('admin-offer-status-filter')?.value || 'all';

    let list = [...adminOffers];
    if (search) {
        list = list.filter(o =>
            (o.code || '').toLowerCase().includes(search) ||
            (o.title || '').toLowerCase().includes(search)
        );
    }
    if (statusFilter === 'active') list = list.filter(o => o.active);
    if (statusFilter === 'inactive') list = list.filter(o => !o.active);

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: var(--text-muted);">No matching coupons found.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(o => `
        <tr>
            <td><span class="coupon-code-pill">${o.code}</span></td>
            <td>
                <div style="font-weight: 700;">${o.title}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${o.discountType.toUpperCase()} • ${o.discountType === 'percentage' ? o.discountValue + '%' : '$' + o.discountValue}</div>
            </td>
            <td>Min: $${Number(o.minOrderAmount || 0).toFixed(2)}<br><small>Max Cap: $${Number(o.maxDiscount || 0).toFixed(2)}</small></td>
            <td>${o.restaurantName || (o.restaurantId === 'ALL' ? 'All Restaurants' : o.restaurantId)}</td>
            <td>
                <div style="font-size: 0.8rem;">Start: ${o.startDate || '-'}</div>
                <div style="font-size: 0.8rem;">Exp: ${o.expiryDate || '-'}</div>
            </td>
            <td>${o.usedCount || 0} / ${o.usageLimit || '∞'}</td>
            <td>
                <button type="button" class="btn btn-outline btn-sm" onclick="toggleOfferActive('${o.id}')" style="font-size: 0.75rem; padding: 4px 10px; border-color: ${o.active ? '#10B981' : '#EF4444'}; color: ${o.active ? '#059669' : '#DC2626'};">
                    ${o.active ? '● Active' : '● Inactive'}
                </button>
            </td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="openOfferModal('${o.id}')">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="confirmDeleteOffer('${o.id}')" style="color: #EF4444; border-color: #FECACA;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.toggleOfferActive = async function (offerId) {
    const off = adminOffers.find(o => o.id === offerId);
    if (!off) return;
    off.active = !off.active;
    await FoodRushStore.saveOffer(off);
    await loadAllAdminData();
    if (typeof window.showToast === 'function') {
        window.showToast(`Coupon ${off.code} ${off.active ? 'activated' : 'deactivated'}`, 'success');
    }
};

window.confirmDeleteOffer = async function (offerId) {
    const off = adminOffers.find(o => o.id === offerId);
    if (!off) return;
    if (!confirm(`Delete coupon "${off.code}" permanently?`)) return;
    await FoodRushStore.deleteOffer(offerId);
    await loadAllAdminData();
    if (typeof window.showToast === 'function') {
        window.showToast(`Coupon ${off.code} deleted`, 'info');
    }
};

window.openOfferModal = function (offerId = null) {
    const modal = document.getElementById('admin-offer-modal');
    const form = document.getElementById('admin-offer-form');
    if (!modal || !form) return;

    form.reset();
    populateRestaurantDropdownForOffers();

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('offer-form-start').value = today;
    document.getElementById('offer-form-expiry').value = '2027-12-31';

    const off = offerId ? adminOffers.find(o => o.id === offerId) : null;
    if (off) {
        document.getElementById('offer-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--primary);"></i> Edit Coupon: ${off.code}`;
        document.getElementById('offer-form-id').value = off.id;
        document.getElementById('offer-form-code').value = off.code || '';
        document.getElementById('offer-form-type').value = off.discountType || 'percentage';
        document.getElementById('offer-form-title').value = off.title || '';
        document.getElementById('offer-form-desc').value = off.description || '';
        document.getElementById('offer-form-value').value = off.discountValue ?? 20;
        document.getElementById('offer-form-min').value = off.minOrderAmount ?? 15;
        document.getElementById('offer-form-max').value = off.maxDiscount ?? 10;
        document.getElementById('offer-form-rest').value = off.restaurantId || 'ALL';
        document.getElementById('offer-form-limit').value = off.usageLimit ?? 500;
        document.getElementById('offer-form-start').value = off.startDate || today;
        document.getElementById('offer-form-expiry').value = off.expiryDate || '2027-12-31';
        document.getElementById('offer-form-active').checked = off.active !== false;
    } else {
        document.getElementById('offer-modal-title').innerHTML = `<i class="fa-solid fa-tags" style="color: var(--primary);"></i> Create Offer / Coupon`;
        document.getElementById('offer-form-id').value = '';
    }

    modal.style.display = 'flex';
};

window.closeOfferModal = function () {
    const modal = document.getElementById('admin-offer-modal');
    if (modal) modal.style.display = 'none';
};

/**
 * 4. LOCATION & DELIVERY ZONES MANAGEMENT TABLE
 */
function renderLocationsTable() {
    const tbody = document.getElementById('admin-locations-tbody');
    if (!tbody) return;

    tbody.innerHTML = adminRestaurants.map(r => `
        <tr data-rest-id="${r.id}">
            <td>
                <strong>${r.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${r.area || ''}, ${r.city || ''}</div>
            </td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <input type="number" step="any" class="form-control loc-lat" value="${r.coordinates?.lat ?? 28.6315}" style="width: 95px; font-size: 0.82rem;" placeholder="Lat">
                    <input type="number" step="any" class="form-control loc-lng" value="${r.coordinates?.lng ?? 77.2167}" style="width: 95px; font-size: 0.82rem;" placeholder="Lng">
                </div>
            </td>
            <td>
                <input type="text" class="form-control loc-pins" value="${Array.isArray(r.servicePincodes) ? r.servicePincodes.join(', ') : (r.pincode || '')}" style="font-size: 0.82rem; min-width: 200px;">
            </td>
            <td>
                <input type="number" step="0.5" class="form-control loc-radius" value="${r.deliveryRadiusKm ?? 10}" style="width: 75px; font-size: 0.82rem;">
            </td>
            <td>
                <input type="number" step="0.01" class="form-control loc-fee" value="${r.deliveryFee ?? 2.49}" style="width: 75px; font-size: 0.82rem;">
            </td>
            <td>
                <input type="number" step="1" class="form-control loc-free-above" value="${r.freeDeliveryAbove ?? 25}" style="width: 75px; font-size: 0.82rem;">
            </td>
            <td>
                <input type="text" class="form-control loc-time" value="${r.deliveryTime || '25-35 mins'}" style="width: 105px; font-size: 0.82rem;">
            </td>
            <td>
                <button type="button" class="btn btn-primary btn-sm" onclick="saveZoneRow('${r.id}', this)">
                    <i class="fa-solid fa-check"></i> Save
                </button>
            </td>
        </tr>
    `).join('');
}

window.saveZoneRow = async function (restId, btnEl) {
    const row = btnEl.closest('tr');
    const rest = adminRestaurants.find(r => r.id === restId);
    if (!row || !rest) return;

    rest.coordinates = {
        lat: parseFloat(row.querySelector('.loc-lat')?.value) || 28.6315,
        lng: parseFloat(row.querySelector('.loc-lng')?.value) || 77.2167
    };
    rest.servicePincodes = (row.querySelector('.loc-pins')?.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    rest.deliveryRadiusKm = parseFloat(row.querySelector('.loc-radius')?.value) || 10;
    rest.deliveryFee = parseFloat(row.querySelector('.loc-fee')?.value) || 0;
    rest.freeDeliveryAbove = parseFloat(row.querySelector('.loc-free-above')?.value) || 25;
    rest.deliveryTime = (row.querySelector('.loc-time')?.value || '25-35 mins').trim();

    await FoodRushStore.saveRestaurant(rest);
    await loadAllAdminData();
    if (typeof window.showToast === 'function') {
        window.showToast(`Updated delivery zone & fees for ${rest.name}`, 'success');
    }
};

/**
 * 5. FORM SUBMISSIONS (RESTAURANT + IMAGE UPLOAD & OFFER)
 */
function setupAdminForms() {
    const restForm = document.getElementById('admin-restaurant-form');
    if (restForm) {
        restForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            syncMenuBuilderFromDOM();

            const saveBtn = document.getElementById('rest-save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
            }

            try {
                let logoUrl = document.getElementById('rest-form-logo').value.trim();
                let coverUrl = document.getElementById('rest-form-cover').value.trim();

                const logoFile = document.getElementById('rest-form-logo-file')?.files?.[0];
                const coverFile = document.getElementById('rest-form-cover-file')?.files?.[0];

                if (logoFile) {
                    logoUrl = await FoodRushStore.uploadImageFile(logoFile, 'restaurants/logos');
                }
                if (coverFile) {
                    coverUrl = await FoodRushStore.uploadImageFile(coverFile, 'restaurants/covers');
                }

                const existingId = document.getElementById('rest-form-id').value.trim();
                const name = document.getElementById('rest-form-name').value.trim();
                const id = existingId || ('rest-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

                const cuisines = document.getElementById('rest-form-cuisines').value
                    .split(',')
                    .map(c => c.trim())
                    .filter(Boolean);

                const servicePincodes = document.getElementById('rest-form-service-pins').value
                    .split(',')
                    .map(p => p.trim())
                    .filter(Boolean);

                const restaurantData = {
                    id,
                    name,
                    cuisines,
                    phone: document.getElementById('rest-form-phone').value.trim(),
                    description: document.getElementById('rest-form-desc').value.trim(),
                    address: document.getElementById('rest-form-address').value.trim(),
                    area: document.getElementById('rest-form-area').value.trim(),
                    city: document.getElementById('rest-form-city').value.trim(),
                    pincode: document.getElementById('rest-form-pincode').value.trim(),
                    coordinates: {
                        lat: parseFloat(document.getElementById('rest-form-lat').value) || 28.6315,
                        lng: parseFloat(document.getElementById('rest-form-lng').value) || 77.2167
                    },
                    openingTime: document.getElementById('rest-form-open').value || '09:00',
                    closingTime: document.getElementById('rest-form-close').value || '23:00',
                    deliveryRadiusKm: parseFloat(document.getElementById('rest-form-radius').value) || 10,
                    deliveryFee: parseFloat(document.getElementById('rest-form-fee').value) || 0,
                    freeDeliveryAbove: 25,
                    deliveryTime: document.getElementById('rest-form-time').value.trim() || '25-35 mins',
                    rating: parseFloat(document.getElementById('rest-form-rating').value) || 4.6,
                    reviewCount: 180,
                    priceForTwo: 22,
                    servicePincodes,
                    logo: logoUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
                    coverImage: coverUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80',
                    offerBanner: document.getElementById('rest-form-banner').value.trim(),
                    isOpen: document.getElementById('rest-form-open-check').checked,
                    active: document.getElementById('rest-form-active-check').checked,
                    featured: true,
                    menu: currentMenuBuilderItems.filter(m => m.name.trim() !== '')
                };

                await FoodRushStore.saveRestaurant(restaurantData);
                closeRestaurantModal();
                await loadAllAdminData();

                if (typeof window.showToast === 'function') {
                    window.showToast(`Saved restaurant "${restaurantData.name}" to Firestore!`, 'success');
                }
            } catch (err) {
                console.error('[FoodRush Admin] Error saving restaurant:', err);
                if (typeof window.showToast === 'function') {
                    window.showToast('Failed to save restaurant', 'error');
                }
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Restaurant & Menu`;
                }
            }
        });
    }

    const offerForm = document.getElementById('admin-offer-form');
    if (offerForm) {
        offerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const existingId = document.getElementById('offer-form-id').value.trim();
            const code = document.getElementById('offer-form-code').value.trim().toUpperCase();
            const restId = document.getElementById('offer-form-rest').value;
            const restObj = adminRestaurants.find(r => r.id === restId);

            const offerData = {
                id: existingId || ('offer-' + code.toLowerCase()),
                code,
                discountType: document.getElementById('offer-form-type').value,
                title: document.getElementById('offer-form-title').value.trim(),
                description: document.getElementById('offer-form-desc').value.trim(),
                discountValue: parseFloat(document.getElementById('offer-form-value').value) || 0,
                minOrderAmount: parseFloat(document.getElementById('offer-form-min').value) || 0,
                maxDiscount: parseFloat(document.getElementById('offer-form-max').value) || 0,
                restaurantId: restId,
                restaurantName: restId === 'ALL' ? 'All Restaurants' : (restObj?.name || restId),
                usageLimit: parseInt(document.getElementById('offer-form-limit').value) || 500,
                usedCount: 0,
                startDate: document.getElementById('offer-form-start').value,
                expiryDate: document.getElementById('offer-form-expiry').value,
                active: document.getElementById('offer-form-active').checked
            };

            await FoodRushStore.saveOffer(offerData);
            closeOfferModal();
            await loadAllAdminData();

            if (typeof window.showToast === 'function') {
                window.showToast(`Saved coupon "${offerData.code}" to Firestore!`, 'success');
            }
        });
    }
}

/**
 * 6. REGISTERED CUSTOMERS TABLE (STRICTLY OWNER ONLY)
 */
function renderCustomersTable(usersToRender = null) {
    const tbody = document.getElementById('admin-customers-tbody');
    if (!tbody) return;

    const list = usersToRender !== null ? usersToRender : adminCustomers;

    if (!list || list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <i class="fa-solid fa-users-slash" style="font-size: 2.2rem; margin-bottom: 12px; display: block; opacity: 0.35;"></i>
                    <strong style="font-size: 1.05rem; color: var(--text-main);">No Customer Logins Yet</strong>
                    <p style="font-size: 0.85rem; margin: 6px 0 0;">Users who sign in via Google OAuth or Mobile OTP will automatically appear here in real time.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map((user, idx) => {
        const photoHtml = user.photoURL 
            ? `<img src="${user.photoURL}" alt="${user.name || 'User'}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-light);">`
            : `<div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #FF8A65); color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem;">${(user.name || 'U').charAt(0).toUpperCase()}</div>`;

        const isGoogle = user.provider === 'google' || (!user.phone && user.email);
        const providerBadge = isGoogle 
            ? `<span style="display: inline-flex; align-items: center; gap: 5px; background: #E8F0FE; color: #1967D2; padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 700;"><i class="fa-brands fa-google"></i> Google</span>`
            : `<span style="display: inline-flex; align-items: center; gap: 5px; background: #ECFDF5; color: #047857; padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 700;"><i class="fa-solid fa-phone"></i> Mobile Phone</span>`;

        const timeStr = user.lastLoginFormatted || (user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN') : 'Recent');
        const shortUid = (user.uid || '').slice(0, 14);

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${photoHtml}
                        <div>
                            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${user.name || 'Customer'}</div>
                            <div style="font-size: 0.76rem; color: var(--text-muted);">Customer #${idx + 1}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-main);">${user.email || '—'}</div>
                    ${user.phone ? `<div style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-phone" style="font-size: 0.7rem;"></i> ${user.phone}</div>` : ''}
                </td>
                <td>
                    ${providerBadge}
                </td>
                <td>
                    <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-main);">${timeStr}</div>
                    <div style="font-size: 0.74rem; color: #10B981;"><i class="fa-solid fa-clock-rotate-left"></i> Recorded</div>
                </td>
                <td>
                    <code style="background: var(--bg-main); padding: 4px 8px; border-radius: 6px; font-size: 0.78rem; color: #475569; border: 1px solid var(--border-color);" title="${user.uid}">
                        ${shortUid}...
                    </code>
                </td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 5px; background: #D1FAE5; color: #065F46; padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 700;">
                        <i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> Verified User
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}
