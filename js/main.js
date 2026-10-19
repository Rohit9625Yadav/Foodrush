/**
 * FoodRush - Global JavaScript (main.js)
 * Handles navbar, mobile drawer, toasts, back-to-top, user session badge, and Clean Extensionless URLs
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initMobileNav();
    initBackToTop();
    updateCartCountBadge();
    initUserSessionBadge();
    highlightActiveNavLink();
    initMyOrders();
});

/* --- Smart Fixed Header Scroll Effect (Slide Up on Scroll Down, Instant Reveal on Scroll Up) --- */
function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    adjustBodyHeaderPadding();
    window.addEventListener('resize', adjustBodyHeaderPadding);

    let lastScrollY = Math.max(0, window.pageYOffset || document.documentElement.scrollTop);
    let isTicking = false;

    function handleScroll() {
        const drawer = document.getElementById('mobile-nav-drawer');
        const isDrawerActive = drawer && (drawer.classList.contains('active') || document.body.classList.contains('mobile-drawer-open'));
        const ordersModal = document.getElementById('foodrush-orders-modal');
        const isModalActive = ordersModal && ordersModal.classList.contains('active');

        // When drawer or modal is open, navbar stays 100% visible and fixed in place
        if (isDrawerActive || isModalActive) {
            header.classList.remove('nav-hidden');
            header.classList.add('nav-visible');
            isTicking = false;
            return;
        }

        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const rawScroll = window.pageYOffset || document.documentElement.scrollTop;
        const currentScrollY = Math.max(0, Math.min(rawScroll, maxScroll));
        const delta = currentScrollY - lastScrollY;

        // Apply scrolled style for soft shadow & backdrop blur
        if (currentScrollY > 20) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // 1. If at or near top of the page (within 40px), ALWAYS show navbar
        if (currentScrollY <= 40) {
            header.classList.remove('nav-hidden');
            header.classList.add('nav-visible');
        }
        // 2. Scrolling UP even slightly (delta <= -2px anywhere on page, even after scrolling all the way to bottom): IMMEDIATELY show navbar!
        else if (delta <= -2) {
            header.classList.remove('nav-hidden');
            header.classList.add('nav-visible');
        }
        // 3. Scrolling DOWN (delta >= 6px) and past 60px: smoothly slide navbar up
        else if (delta >= 6 && currentScrollY > 60) {
            header.classList.add('nav-hidden');
            header.classList.remove('nav-visible');
        }

        lastScrollY = currentScrollY;
        isTicking = false;
    }

    window.addEventListener('scroll', () => {
        if (!isTicking) {
            window.requestAnimationFrame(handleScroll);
            isTicking = true;
        }
    }, { passive: true });
}

function adjustBodyHeaderPadding() {
    const header = document.querySelector('.site-header');
    if (header && !document.querySelector('.admin-layout')) {
        const h = header.offsetHeight;
        if (h > 0) {
            document.body.style.paddingTop = h + 'px';
        }
    }
}

/* --- Mobile Navigation Drawer (Locked Viewport, No Bottom Gaps, Firm Navbar) --- */
function initMobileNav() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    const drawer = document.getElementById('mobile-nav-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const header = document.querySelector('.site-header');

    if (!drawer) return;

    // Ensure drawer footer has both Order Food and Checkout buttons with proper safe-area spacing
    const footer = drawer.querySelector('.drawer-footer');
    if (footer) {
        footer.innerHTML = `
            <a href="/menu/" class="btn btn-primary btn-block" style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700;">
                <i class="fa-solid fa-utensils"></i> Order Food
            </a>
            <a href="/checkout/" class="btn btn-outline btn-block" style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; border-color: var(--primary); color: var(--primary);">
                <i class="fa-solid fa-bag-shopping"></i> Proceed to Checkout
            </a>
        `;
    }

    // Ensure "My Orders & History" item is in the mobile drawer links
    const mobileLinks = drawer.querySelector('.mobile-links');
    if (mobileLinks && !mobileLinks.querySelector('.my-orders-btn-trigger')) {
        const ordersItem = document.createElement('a');
        ordersItem.href = 'javascript:void(0)';
        ordersItem.className = 'mobile-nav-item my-orders-btn-trigger';
        ordersItem.id = 'mobile-drawer-orders-btn';
        ordersItem.innerHTML = `
            <i class="fa-solid fa-receipt"></i>
            <span>My Orders & History</span>
            <span class="orders-count-chip" id="mobile-orders-count-chip" style="margin-left:auto; background:var(--primary); color:#fff; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:12px; display:none;">0</span>
        `;
        const cartLink = mobileLinks.querySelector('a[href*="/cart/"]');
        if (cartLink) {
            mobileLinks.insertBefore(ordersItem, cartLink);
        } else {
            mobileLinks.appendChild(ordersItem);
        }
    }

    // Ensure "Orders" link is in desktop .nav-links
    const desktopNav = document.querySelector('.nav-links');
    if (desktopNav && !desktopNav.querySelector('.my-orders-btn-trigger')) {
        const desktopOrders = document.createElement('a');
        desktopOrders.href = 'javascript:void(0)';
        desktopOrders.className = 'nav-item my-orders-btn-trigger';
        desktopOrders.innerHTML = '<i class="fa-solid fa-receipt" style="margin-right: 4px;"></i> Orders';
        desktopNav.appendChild(desktopOrders);
    }

    if (!hamburgerBtn) return;

    let savedScrollY = 0;

    function openDrawer() {
        savedScrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        // Lock body firmly to prevent background scroll and bottom rubber-band gaps
        document.body.style.position = 'fixed';
        document.body.style.top = `-${savedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        document.body.classList.add('mobile-drawer-open');

        // Keep navbar pinned and visible
        if (header) {
            header.classList.remove('nav-hidden');
            header.classList.add('nav-visible');
        }

        drawer.classList.add('active');
        if (overlay) overlay.classList.add('active');
    }

    function closeDrawer() {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.classList.remove('mobile-drawer-open');

        window.scrollTo(0, savedScrollY);

        drawer.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }

    hamburgerBtn.addEventListener('click', openDrawer);
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);

    // Prevent background touchmove through overlay
    if (overlay) {
        overlay.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
}

/* --- Toast Notification System --- */
function showToast(message, type = 'primary') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon based on type
    let iconClass = 'fa-solid fa-circle-check';
    if (type === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';
    if (type === 'danger') iconClass = 'fa-solid fa-circle-xmark';

    toast.innerHTML = `
        <i class="${iconClass}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3200);
}

/* --- Back to Top Button --- */
function initBackToTop() {
    let btn = document.getElementById('back-to-top');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'back-to-top';
        btn.setAttribute('aria-label', 'Back to top');
        btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        document.body.appendChild(btn);
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

/* --- Cart Count Sync --- */
function updateCartCountBadge() {
    const badges = document.querySelectorAll('.cart-count');
    if (!badges.length) return;

    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('foodrush_cart')) || [];
    } catch (e) {
        cart = [];
    }

    const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    badges.forEach(badge => {
        badge.textContent = totalCount;
        badge.classList.add('bump');
        setTimeout(() => badge.classList.remove('bump'), 300);
    });
}

/* --- User Session Display --- */
function initUserSessionBadge() {
    const authContainers = document.querySelectorAll('.auth-nav-container');
    if (!authContainers.length) return;

    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('foodrush_user'));
    } catch (e) {
        user = null;
    }

    authContainers.forEach(container => {
        if (user && user.isLoggedIn) {
            const avatarBg = user.provider === 'google' ? 'background: #4285F4;' : 'background: #FF5722;';
            const displayName = user.name ? user.name.split(' ')[0] : 'User';
            const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

            container.innerHTML = `
                <div class="user-logged-in-wrap" style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" class="my-orders-nav-btn my-orders-btn-trigger" title="View My Orders & History">
                        <i class="fa-solid fa-receipt"></i>
                        <span>My Orders</span>
                        <span class="orders-count-badge" id="header-orders-count" style="display:none;"></span>
                    </button>
                    <a href="/auth/" class="user-profile-badge" title="My Account (${user.email || user.phone})">
                        <div class="user-avatar" style="${avatarBg}">${initial}</div>
                        <span style="font-weight: 700;">${displayName}</span>
                    </a>
                    <button type="button" class="btn btn-outline btn-sm global-logout-btn" style="padding: 4px 10px; font-size: 0.8rem; border-color: var(--border-color);" title="Logout">
                        <i class="fa-solid fa-arrow-right-from-bracket"></i>
                    </button>
                </div>
            `;

            const logoutBtn = container.querySelector('.global-logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (window.FoodRushAuth && typeof window.FoodRushAuth.signOutUser === 'function') {
                        window.FoodRushAuth.signOutUser();
                    } else {
                        localStorage.removeItem('foodrush_user');
                        window.location.href = '/home/';
                    }
                });
            }
        } else {
            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" class="my-orders-nav-btn my-orders-btn-trigger" title="Track & View Orders" style="background: transparent; color: var(--text-main); border-color: var(--border-color);">
                        <i class="fa-solid fa-receipt"></i>
                        <span>Orders</span>
                    </button>
                    <a href="/auth/" class="btn btn-primary user-nav-btn">
                        <i class="fa-regular fa-user"></i>
                        <span>Login</span>
                    </a>
                </div>
            `;
        }
    });
}

/* --- Highlight Active Navigation Link & In-Page Section Tracking --- */
function highlightActiveNavLink() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    let currentPage = pathParts.pop() || 'home';
    currentPage = currentPage.replace(/\.html$/, '');
    if (currentPage === '' || currentPage === 'index') currentPage = 'home';

    const currentHash = (window.location.hash || '').toLowerCase();

    const navLinks = document.querySelectorAll('.nav-item, .mobile-nav-item');
    navLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const parts = href.split('#');
        const baseHref = parts[0] || '';
        const linkHash = (parts[1] || '').toLowerCase();

        let cleanHref = baseHref.split('?')[0].replace(/\.html$/, '').replace(/^\//, '').replace(/\/$/, '');
        if (cleanHref === '' || cleanHref === 'index') cleanHref = 'home';

        if (cleanHref === currentPage) {
            // Precise section handling on about-contact to prevent both About & Contact being active
            if (currentPage === 'about-contact') {
                if (currentHash === '#contact') {
                    if (linkHash === 'contact') {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                } else {
                    // Default to About section when hash is #about, empty, or top of page
                    if (linkHash === 'about') {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                }
            } else {
                link.classList.add('active');
            }
        } else {
            link.classList.remove('active');
        }
    });
}

// Listen to hash changes (e.g. clicking between #about and #contact)
window.addEventListener('hashchange', highlightActiveNavLink);

// Scroll spy for about-contact page
function initAboutContactScrollSpy() {
    const contactSection = document.getElementById('contact');
    const aboutSection = document.getElementById('about');
    if (!contactSection && !aboutSection) return;

    window.addEventListener('scroll', () => {
        if (!contactSection) return;
        const contactTop = contactSection.getBoundingClientRect().top;
        if (contactTop <= 250) {
            updateAboutContactNav('contact');
        } else {
            updateAboutContactNav('about');
        }
    }, { passive: true });
}

function updateAboutContactNav(activeSection) {
    const navLinks = document.querySelectorAll('.nav-item, .mobile-nav-item');
    navLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        if (href.includes('/about-contact/')) {
            if (href.includes('#' + activeSection)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        }
    });
}

// Call scroll spy on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initAboutContactScrollSpy();
});

/* --- Customer My Orders & Order History System --- */
let activeOrdersData = [];
let ordersFilterType = 'all';

function initMyOrders() {
    createOrdersModalIfMissing();
    attachOrdersTriggerListeners();
    updateCustomerOrdersBadge();
}

function createOrdersModalIfMissing() {
    if (document.getElementById('foodrush-orders-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'foodrush-orders-modal';
    modal.id = 'foodrush-orders-modal';
    modal.innerHTML = `
        <div class="orders-modal-card">
            <div class="orders-modal-header">
                <div class="orders-modal-title-group">
                    <div class="orders-modal-icon">
                        <i class="fa-solid fa-receipt"></i>
                    </div>
                    <div>
                        <h2 class="orders-modal-title">
                            My Orders & History
                            <span class="orders-count-badge" id="orders-modal-count-badge">0 Orders</span>
                        </h2>
                        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                            Track live food preparation, delivery status & past meals
                        </div>
                    </div>
                </div>
                <button type="button" class="orders-modal-close" id="orders-modal-close-btn" aria-label="Close orders modal">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="orders-modal-toolbar">
                <div class="orders-search-input-wrap">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="orders-modal-search" class="orders-search-input" placeholder="Search by food dish, Order ID, or phone number...">
                </div>
                <div class="orders-filter-pills">
                    <button type="button" class="orders-filter-btn active" data-filter="all">All Orders</button>
                    <button type="button" class="orders-filter-btn" data-filter="active">Live & Preparing</button>
                    <button type="button" class="orders-filter-btn" data-filter="delivered">Delivered</button>
                </div>
            </div>

            <div class="orders-modal-body" id="orders-modal-list">
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.8rem; margin-bottom: 12px; display: block; color: var(--primary);"></i>
                    Loading your orders...
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeBtn = modal.querySelector('#orders-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeMyOrdersModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeMyOrdersModal();
    });

    // Search & Filter listeners
    const searchInput = modal.querySelector('#orders-modal-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderOrdersListInModal();
        });
    }

    modal.querySelectorAll('.orders-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.orders-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ordersFilterType = btn.getAttribute('data-filter') || 'all';
            renderOrdersListInModal();
        });
    });
}

function attachOrdersTriggerListeners() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.my-orders-btn-trigger');
        if (trigger) {
            e.preventDefault();
            // Close mobile drawer if open
            const drawer = document.getElementById('mobile-nav-drawer');
            const overlay = document.getElementById('drawer-overlay');
            if (drawer) drawer.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
            
            openMyOrdersModal();
        }
    });
}

async function openMyOrdersModal() {
    createOrdersModalIfMissing();
    const modal = document.getElementById('foodrush-orders-modal');
    if (!modal) return;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show navbar
    const header = document.querySelector('.site-header');
    if (header) {
        header.classList.remove('nav-hidden');
        header.classList.add('nav-visible');
    }

    await loadCustomerOrders();
    renderOrdersListInModal();
}

function closeMyOrdersModal() {
    const modal = document.getElementById('foodrush-orders-modal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Make accessible on window
window.openMyOrdersModal = openMyOrdersModal;
window.closeMyOrdersModal = closeMyOrdersModal;

async function loadCustomerOrders() {
    let allOrders = [];

    // Try fetching from FoodRushStore
    try {
        if (window.FoodRushStore && typeof window.FoodRushStore.fetchOrders === 'function') {
            allOrders = await window.FoodRushStore.fetchOrders();
        } else {
            const res = await fetch('/api/orders');
            if (res.ok) {
                const data = await res.json();
                allOrders = data.orders || [];
            }
        }
    } catch (e) {
        // Fallback to local cache
    }

    // Also merge local cache
    let localCache = [];
    try {
        localCache = JSON.parse(localStorage.getItem('foodrush_orders_cache_v2')) || [];
    } catch(e) {}

    const orderMap = new Map();
    allOrders.forEach(o => {
        if (o && o.orderId) orderMap.set(o.orderId, o);
    });
    localCache.forEach(o => {
        if (o && o.orderId && !orderMap.has(o.orderId)) {
            orderMap.set(o.orderId, o);
        }
    });

    const combined = Array.from(orderMap.values());

    // Get current logged-in user
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('foodrush_user'));
    } catch(e) {}

    if (user && user.isLoggedIn) {
        const uEmail = (user.email || '').toLowerCase().trim();
        const uPhone = (user.phone || user.phoneNumber || '').replace(/\D/g, '').trim();
        const uUid = (user.uid || '').trim();

        activeOrdersData = combined.filter(o => {
            const oEmail = (o.userEmail || '').toLowerCase().trim();
            const oPhone = (o.phone || (o.details && o.details.phone) || '').replace(/\D/g, '').trim();
            const oUid = (o.userId || '').trim();

            const matchUid = uUid && oUid && oUid === uUid;
            const matchEmail = uEmail && oEmail && oEmail === uEmail;
            const matchPhone = uPhone && oPhone && (oPhone === uPhone || oPhone.includes(uPhone));

            return matchUid || matchEmail || matchPhone;
        });

        // If no user-specific matches were found, fall back to orders stored locally
        if (activeOrdersData.length === 0 && localCache.length > 0) {
            activeOrdersData = localCache;
        }
    } else {
        // Guest user: show orders placed on this device
        activeOrdersData = localCache;
    }

    // Sort newest first
    activeOrdersData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    updateCustomerOrdersBadge();
}

function updateCustomerOrdersBadge() {
    let count = activeOrdersData.length;
    if (count === 0) {
        try {
            const cached = JSON.parse(localStorage.getItem('foodrush_orders_cache_v2')) || [];
            count = cached.length;
        } catch(e) {}
    }

    const modalBadge = document.getElementById('orders-modal-count-badge');
    if (modalBadge) {
        modalBadge.textContent = `${count} ${count === 1 ? 'Order' : 'Orders'}`;
    }

    const mobileChip = document.getElementById('mobile-orders-count-chip');
    if (mobileChip) {
        if (count > 0) {
            mobileChip.style.display = 'inline-block';
            mobileChip.textContent = count;
        } else {
            mobileChip.style.display = 'none';
        }
    }

    const headerBadge = document.getElementById('header-orders-count');
    if (headerBadge) {
        if (count > 0) {
            headerBadge.style.display = 'inline-block';
            headerBadge.textContent = count;
        } else {
            headerBadge.style.display = 'none';
        }
    }
}

function renderOrdersListInModal() {
    const container = document.getElementById('orders-modal-list');
    if (!container) return;

    const searchInput = document.getElementById('orders-modal-search');
    const query = (searchInput?.value || '').toLowerCase().trim();

    let filtered = activeOrdersData.filter(order => {
        // Status filter
        const status = (order.status || 'Placed').toLowerCase();
        if (ordersFilterType === 'active') {
            if (status === 'delivered' || status === 'cancelled') return false;
        } else if (ordersFilterType === 'delivered') {
            if (status !== 'delivered') return false;
        }

        // Query filter
        if (!query) return true;
        const orderId = (order.orderId || '').toLowerCase();
        const restName = (order.restaurant || (order.details && order.details.restaurant) || '').toLowerCase();
        const items = (order.items || []).map(i => (i.name || '').toLowerCase()).join(' ');
        const phone = (order.phone || (order.details && order.details.phone) || '');

        return orderId.includes(query) || restName.includes(query) || items.includes(query) || phone.includes(query);
    });

    if (filtered.length === 0) {
        const isSearch = !!query || ordersFilterType !== 'all';
        container.innerHTML = `
            <div class="orders-empty-state">
                <div class="orders-empty-icon">
                    <i class="fa-solid ${isSearch ? 'fa-magnifying-glass' : 'fa-receipt'}"></i>
                </div>
                <div class="orders-empty-title">
                    ${isSearch ? 'No Matching Orders Found' : 'No Orders Placed Yet'}
                </div>
                <p class="orders-empty-desc">
                    ${isSearch 
                        ? 'Try searching with a different dish name, phone number, or Order ID.' 
                        : 'You haven’t ordered any food yet. Explore our top-rated restaurants and enjoy fresh, delicious food delivered fast!'}
                </p>
                <a href="/menu/" class="btn btn-primary" onclick="closeMyOrdersModal()">
                    <i class="fa-solid fa-utensils"></i> Browse Menu & Order Now
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(order => {
        const orderId = order.orderId || '#ORD-0000';
        const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Recent';

        const status = order.status || 'Placed';
        let statusPill = '';
        let statusIcon = 'fa-clock';
        let statusClass = 'status-placed';

        if (status === 'Preparing') {
            statusIcon = 'fa-fire-burner';
            statusClass = 'status-preparing';
        } else if (status === 'Out for Delivery') {
            statusIcon = 'fa-motorcycle';
            statusClass = 'status-out';
        } else if (status === 'Delivered') {
            statusIcon = 'fa-circle-check';
            statusClass = 'status-delivered';
        } else if (status === 'Cancelled') {
            statusIcon = 'fa-circle-xmark';
            statusClass = 'status-cancelled';
        }

        statusPill = `<span class="order-status-pill ${statusClass}"><i class="fa-solid ${statusIcon}"></i> ${status}</span>`;

        const restName = order.restaurant || (order.details && order.details.restaurant) || 'FoodRush Kitchen Partner';
        const items = order.items || [];
        const itemsHtml = items.map(item => `
            <div class="order-item-row">
                <div class="order-item-name">
                    <span style="font-weight: 700; color: var(--primary);">${item.quantity || 1}x</span>
                    <span>${item.name || 'Dish'}</span>
                </div>
                <div class="order-item-price">₹${(item.price || 0) * (item.quantity || 1)}</div>
            </div>
        `).join('');

        const totalAmount = order.details?.totals?.total || order.totalAmount || items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
        const paymentMode = order.details?.paymentMethod ? order.details.paymentMethod.toUpperCase() : 'ONLINE / COD';
        const address = order.details?.address || order.address || 'Standard Delivery';

        return `
            <div class="order-history-card">
                <div class="order-card-header">
                    <div>
                        <div class="order-card-id">
                            <i class="fa-solid fa-receipt" style="color: var(--primary);"></i>
                            <span>${orderId}</span>
                        </div>
                        <div class="order-card-date">
                            <i class="fa-regular fa-calendar"></i> ${dateStr}
                        </div>
                    </div>
                    ${statusPill}
                </div>

                <div class="order-card-rest">
                    <i class="fa-solid fa-store"></i>
                    <span>${restName}</span>
                </div>

                <div class="order-card-items-list">
                    ${itemsHtml || '<div style="color:var(--text-muted); font-size:0.8rem;">Items details unavailable</div>'}
                </div>

                <div class="order-card-meta">
                    <div>
                        <i class="fa-solid fa-location-dot" style="color: var(--primary);"></i>
                        <span style="margin-left: 4px;">${address}</span>
                    </div>
                    <div>
                        <i class="fa-solid fa-credit-card"></i>
                        <span style="margin-left: 4px;">${paymentMode}</span>
                    </div>
                </div>

                <div class="order-card-footer">
                    <div>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">Total Paid:</span>
                        <div class="order-total-amount">₹${totalAmount}</div>
                    </div>
                    <div class="order-actions-group">
                        <button type="button" class="btn-reorder-order" onclick="window.reorderFoodRushOrder('${orderId}')">
                            <i class="fa-solid fa-rotate-right"></i> Reorder
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.reorderFoodRushOrder = function(orderId) {
    const order = activeOrdersData.find(o => o.orderId === orderId);
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        showToast('Unable to reorder items from this order.', 'warning');
        return;
    }

    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('foodrush_cart')) || [];
    } catch(e) {
        cart = [];
    }

    order.items.forEach(item => {
        const existing = cart.find(ci => ci.id === item.id);
        if (existing) {
            existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
        } else {
            cart.push({ ...item });
        }
    });

    localStorage.setItem('foodrush_cart', JSON.stringify(cart));
    updateCartCountBadge();
    showToast(`🎉 Added ${order.items.length} items from ${orderId} to your Cart!`, 'primary');

    closeMyOrdersModal();
    setTimeout(() => {
        window.location.href = '/cart/';
    }, 600);
};
