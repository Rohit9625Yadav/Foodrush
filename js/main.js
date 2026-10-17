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
});

/* --- Header Scroll Effect --- */
function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

/* --- Mobile Navigation Drawer --- */
function initMobileNav() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    const drawer = document.getElementById('mobile-nav-drawer');
    const overlay = document.getElementById('drawer-overlay');

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

    if (!hamburgerBtn) return;

    function openDrawer() {
        drawer.classList.add('active');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        drawer.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    hamburgerBtn.addEventListener('click', openDrawer);
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);
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
                <a href="/auth/" class="btn btn-primary user-nav-btn">
                    <i class="fa-regular fa-user"></i>
                    <span>Login</span>
                </a>
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
