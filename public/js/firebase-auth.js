/**
 * FoodRush - Firebase Modular Authentication & Session Manager (firebase-auth.js)
 * 
 * Implements:
 * 1. Real Google Authentication via Firebase SDK (signInWithPopup, GoogleAuthProvider)
 * 2. Persistent auth state using browserLocalPersistence & onAuthStateChanged
 * 3. Checkout Auth Gate with automatic order resumption
 * 4. Secure verified user info extraction (email, displayName, uid, photoURL)
 * 5. Robust error handling (popup closed, blocked popup, network error)
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Global FoodRush keys
const ACTIVE_USER_KEY = 'foodrush_user';
const PENDING_ACTION_KEY = 'foodrush_pending_action';

let app = null;
let auth = null;
let googleProvider = null;

// Initialize Firebase with fallback protection
try {
    const config = window.firebaseConfig || {
        apiKey: "AIzaSyDemoKeyFoodRushOfficialAuth2026",
        authDomain: "foodrush-delivery.firebaseapp.com",
        projectId: "foodrush-delivery",
        storageBucket: "foodrush-delivery.appspot.com",
        messagingSenderId: "109823487654",
        appId: "1:109823487654:web:8a7b6c5d4e3f2a1b"
    };

    app = getApps().length === 0 ? initializeApp(config) : getApp();
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    // Enable Local Persistence (stays logged in across refresh & tab close)
    setPersistence(auth, browserLocalPersistence).catch(err => {
        console.warn('Firebase persistence warning:', err);
    });

} catch (err) {
    console.error('Firebase Auth Init Error:', err);
}

/**
 * Listen for Firebase Auth state changes
 * Automatically synchronizes with UI and local storage
 */
if (auth) {
    onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
            // Real verified user from Firebase (Google or Phone)
            const sessionUser = {
                name: firebaseUser.displayName || (firebaseUser.phoneNumber ? 'Mobile Customer' : 'Google User'),
                email: firebaseUser.email || (firebaseUser.phoneNumber ? firebaseUser.phoneNumber : 'user@foodrush.com'),
                phone: firebaseUser.phoneNumber || '',
                uid: firebaseUser.uid,
                photoURL: firebaseUser.photoURL || '',
                provider: firebaseUser.phoneNumber ? 'phone' : 'google',
                isLoggedIn: true,
                isVerified: true
            };

            localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(sessionUser));
            updateUIForAuthState(sessionUser);
            recordUserSession(sessionUser);

            // Check if there is a pending action waiting to resume
            resumePendingActionAfterLogin();
        } else {
            // Do NOT immediately wipe localStorage! 
            // Check if user is logged in via email/phone session in localStorage
            const existing = getCurrentUser();
            if (existing && existing.isLoggedIn) {
                // User is still logged in locally! Keep their session active
                updateUIForAuthState(existing);
            } else {
                updateUIForAuthState(null);
            }
        }
    });

    // Check redirect result if popup was blocked and redirect was used
    try {
        getRedirectResult(auth).then((result) => {
            if (result && result.user) {
                const user = result.user;
                const sessionUser = {
                    name: user.displayName || 'Google User',
                    email: user.email,
                    uid: user.uid,
                    photoURL: user.photoURL || '',
                    provider: 'google',
                    isLoggedIn: true,
                    isVerified: user.emailVerified
                };
                localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(sessionUser));
                updateUIForAuthState(sessionUser);
                recordUserSession(sessionUser);
                if (typeof showToast === 'function') {
                    showToast(`🎉 Welcome, ${sessionUser.name}!`, 'primary');
                }
                closeGoogleAuthModal();
                resumePendingActionAfterLogin();
            }
        }).catch(err => {
            console.warn('Redirect auth notice:', err.message);
        });
    } catch (e) {}
}

/**
 * Synchronize logged in user to Firestore and Admin Customer database
 */
function recordUserSession(sessionUser) {
    if (!sessionUser) return;
    try {
        if (typeof window.FoodRushStore?.syncUserToCloud === 'function') {
            window.FoodRushStore.syncUserToCloud(sessionUser);
        } else {
            import('./store-data.js').then(mod => {
                if (mod?.FoodRushStore?.syncUserToCloud) {
                    mod.FoodRushStore.syncUserToCloud(sessionUser);
                }
            }).catch(() => {});
        }
    } catch(e) {}
}

/**
 * Get current active user from localStorage
 */
export function getCurrentUser() {
    try {
        const raw = localStorage.getItem(ACTIVE_USER_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && (parsed.uid?.startsWith('google-user-') || parsed.password === 'google-oauth-token')) {
            localStorage.removeItem(ACTIVE_USER_KEY);
            return null;
        }
        return parsed;
    } catch (e) {
        return null;
    }
}

/**
 * Check whether user is currently authenticated
 */
export function isAuthenticated() {
    const user = getCurrentUser();
    return !!(user && user.isLoggedIn && user.email);
}

/**
 * Trigger Real Google Sign-In Popup
 * Returns Promise resolving to the sessionUser or rejecting with friendly error
 */
export async function signInWithGoogle() {
    if (!auth || !googleProvider) {
        throw new Error('Firebase Auth is not properly initialized. Please verify your firebaseConfig.');
    }

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        const sessionUser = {
            name: user.displayName || 'Google User',
            email: user.email,
            uid: user.uid,
            photoURL: user.photoURL || '',
            provider: 'google',
            isLoggedIn: true,
            isVerified: user.emailVerified
        };

        localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(sessionUser));
        updateUIForAuthState(sessionUser);
        recordUserSession(sessionUser);

        if (typeof showToast === 'function') {
            showToast(`👋 Welcome, ${sessionUser.name}!`, 'primary');
        }

        // Close modal if open
        closeGoogleAuthModal();

        // Resume any pending order/action
        resumePendingActionAfterLogin();

        return sessionUser;

    } catch (error) {
        console.error('Google Sign-In Error:', error);

        // If popup was blocked by browser, attempt official Firebase redirect flow
        if (error.code === 'auth/popup-blocked') {
            if (typeof showToast === 'function') {
                showToast('Popup blocked by browser. Redirecting to Google Sign-In...', 'warning');
            }
            try {
                await signInWithRedirect(auth, googleProvider);
                return null;
            } catch (redirErr) {
                console.error('Redirect sign-in error:', redirErr);
            }
        }

        // Check if user simply closed / cancelled the Google popup window
        const isCancelled = error.code === 'auth/popup-closed-by-user' ||
                            error.code === 'auth/cancelled-popup-request' ||
                            (error.message && error.message.toLowerCase().includes('closed'));

        if (isCancelled) {
            if (typeof showToast === 'function') {
                showToast('Google Sign-In was cancelled. Click "Continue with Google" anytime to try again.', 'warning');
            }
            const err = new Error('Google Sign-In was cancelled by the user.');
            err.code = 'auth/popup-closed-by-user';
            err.isCancelled = true;
            throw err;
        }

        let friendlyMessage = 'Unable to complete Google Sign-In. Please try again.';
        if (error.code === 'auth/unauthorized-domain') {
            friendlyMessage = `Domain '${window.location.hostname}' is not authorized in Firebase Console.`;
        } else if (error.code === 'auth/operation-not-allowed') {
            friendlyMessage = 'Google Sign-In provider is currently disabled in Firebase Console.';
        } else if (error.code === 'auth/network-request-failed') {
            friendlyMessage = 'Network connection failed. Please check your internet connection.';
        } else if (error.message) {
            friendlyMessage = error.message;
        }

        if (typeof showToast === 'function') {
            showToast(`⚠️ ${friendlyMessage}`, 'warning');
        }

        // Show detailed guidance modal if domain or configuration issue
        showGoogleAuthErrorModal(error);

        throw error;
    }
}

/**
 * Helpful Google Auth Error Guidance Modal
 */
export function showGoogleAuthErrorModal(error) {
    // Never show modal if user intentionally cancelled or closed the popup
    if (error.code === 'auth/popup-closed-by-user' || error.isCancelled ||
        (error.message && error.message.toLowerCase().includes('closed')) ||
        (error.message && error.message.toLowerCase().includes('cancel'))) {
        return;
    }

    let existing = document.getElementById('foodrush-gauth-error-modal');
    if (existing) existing.remove();

    const currentHost = window.location.hostname || 'localhost';
    const isFile = window.location.protocol === 'file:';

    let reasonTitle = 'Google Authentication Notice';
    let instructions = '';

    if (error.code === 'auth/unauthorized-domain') {
        reasonTitle = 'Domain Not Authorized in Firebase';
        instructions = `
            <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin-bottom: 16px; text-align: left; font-size: 0.9rem; color: #92400E; line-height: 1.6;">
                <strong>⚠️ Why did this happen?</strong><br>
                The host domain <strong><code>${currentHost}</code></strong> is not listed under Authorized Domains in your Firebase project.<br><br>
                <strong>🛠️ How to resolve:</strong><br>
                1. Open <a href="https://console.firebase.google.com/project/foodrush-ebb13/authentication/settings" target="_blank" style="color: #1D4ED8; font-weight: 600; text-decoration: underline;">Firebase Console &rarr; foodrush-ebb13</a>.<br>
                2. Navigate to <strong>Authentication &rarr; Settings &rarr; Authorized domains</strong>.<br>
                3. Click <strong>Add domain</strong> and add <code>${currentHost}</code>.<br>
                <em>(Or run the site via <strong>http://localhost:5500</strong> or <strong>http://localhost:5000</strong>).</em>
            </div>
        `;
    } else if (error.code === 'auth/operation-not-allowed') {
        reasonTitle = 'Google Sign-In Provider Disabled';
        instructions = `
            <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin-bottom: 16px; text-align: left; font-size: 0.9rem; color: #92400E; line-height: 1.6;">
                <strong>⚠️ Why did this happen?</strong><br>
                The Google Sign-In provider is currently disabled in your Firebase Authentication settings.<br><br>
                <strong>🛠️ How to resolve:</strong><br>
                1. Open <a href="https://console.firebase.google.com/project/foodrush-ebb13/authentication/providers" target="_blank" style="color: #1D4ED8; font-weight: 600; text-decoration: underline;">Firebase Console &rarr; Sign-in method</a>.<br>
                2. Click on <strong>Google</strong>.<br>
                3. Switch the toggle to <strong>Enable</strong>, select a support email, and click <strong>Save</strong>.
            </div>
        `;
    } else if (isFile || error.code === 'auth/operation-not-supported-in-this-environment') {
        reasonTitle = 'Local File Protocol (file://) Not Supported';
        instructions = `
            <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin-bottom: 16px; text-align: left; font-size: 0.9rem; color: #92400E; line-height: 1.6;">
                Google OAuth security protocols do not support authentication directly from local <code>file:///</code> paths.<br><br>
                Please use <strong>Go Live</strong> in VS Code (http://localhost:5500) or launch the server at <strong><a href="http://localhost:5000" target="_blank" style="color:#1D4ED8; font-weight:600;">http://localhost:5000</a></strong>.
            </div>
        `;
    } else if (error.code === 'auth/popup-blocked') {
        reasonTitle = 'Popup Blocked by Browser';
        instructions = `
            <p style="color: #64748B; font-size: 0.92rem; margin-bottom: 16px; line-height: 1.6;">
                Your browser blocked the Google Sign-In popup window. Please click the popup icon in your browser's address bar and select <strong>"Always allow popups"</strong>, then try again.
            </p>
        `;
    } else {
        reasonTitle = 'Authentication Notice';
        instructions = `
            <div style="background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; text-align: left; font-size: 0.9rem; color: #334155; line-height: 1.6;">
                ${error.message || 'The authentication request could not be completed. Please try again or sign in with your email address.'}
            </div>
        `;
    }

    const modal = document.createElement('div');
    modal.id = 'foodrush-gauth-error-modal';
    modal.className = 'modal-backdrop active';
    modal.style.zIndex = '99999';
    modal.innerHTML = `
        <div style="max-width: 480px; width: 90%; background: #fff; border-radius: 16px; padding: 28px 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); text-align: center; position: relative;">
            <button type="button" id="close-gauth-err-btn" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #64748B;">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div style="width: 52px; height: 52px; background: #FEF3C7; color: #D97706; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; margin: 0 auto 16px;">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 700; color: #1E293B; margin-bottom: 14px;">${reasonTitle}</h3>
            ${instructions}
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 18px;">
                <button type="button" class="btn btn-primary btn-block" id="btn-retry-google-login" style="background: #4285F4; border-color: #4285F4; padding: 12px; font-weight: 600; font-size: 0.95rem;">
                    <i class="fa-brands fa-google" style="margin-right: 8px;"></i> Retry Google Sign-In
                </button>
                <button type="button" class="btn btn-secondary btn-block" id="btn-close-gauth-err" style="padding: 10px;">
                    Close
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeHandler = () => { modal.remove(); };
    document.getElementById('close-gauth-err-btn')?.addEventListener('click', closeHandler);
    document.getElementById('btn-close-gauth-err')?.addEventListener('click', closeHandler);

    document.getElementById('btn-retry-google-login')?.addEventListener('click', () => {
        modal.remove();
        signInWithGoogle();
    });
}

/**
 * Sign out user cleanly
 */
export async function signOutUser() {
    try {
        if (auth) {
            await signOut(auth);
        }
    } catch (e) {
        console.warn('Firebase signout error:', e);
    }
    localStorage.removeItem(ACTIVE_USER_KEY);
    localStorage.removeItem(PENDING_ACTION_KEY);
    updateUIForAuthState(null);

    if (typeof showToast === 'function') {
        showToast('You have been logged out.', 'primary');
    }

    // Clean redirect to Home on logout (avoids static server 404 reload issues)
    setTimeout(() => {
        window.location.href = '/home/';
    }, 400);
}

/**
 * Requirement 2: Require Login at Checkout Gate
 * If authenticated -> executes callback
 * If not authenticated -> saves pending action, opens Google modal
 */
export function requireAuth(actionType = 'checkout', payload = null, callback = null) {
    if (isAuthenticated()) {
        if (typeof callback === 'function') {
            callback(getCurrentUser());
        }
        return true;
    }

    // Save pending action to resume after login (Requirement 3)
    const pendingData = {
        type: actionType,
        payload: payload,
        timestamp: Date.now()
    };
    localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(pendingData));

    // Open Google Sign-In prompt modal
    openGoogleAuthModal(actionType);
    return false;
}

/**
 * Requirement 3: Resume pending action after login
 */
function resumePendingActionAfterLogin() {
    const pendingRaw = localStorage.getItem(PENDING_ACTION_KEY);
    if (!pendingRaw) return;

    try {
        const pending = JSON.parse(pendingRaw);
        localStorage.removeItem(PENDING_ACTION_KEY); // Clear so it only executes once

        // Check if pending action is recent (within 30 mins)
        if (Date.now() - pending.timestamp > 30 * 60 * 1000) return;

        if (pending.type === 'checkout' || pending.type === 'proceed_to_checkout') {
            if (typeof showToast === 'function') {
                showToast('🚀 Resuming your checkout...', 'primary');
            }
            setTimeout(() => {
                window.location.href = '/checkout/';
            }, 600);
        } else if (pending.type === 'buy_now') {
            if (typeof showToast === 'function') {
                showToast('🚀 Order resumed! Taking you to checkout...', 'primary');
            }
            setTimeout(() => {
                window.location.href = '/checkout/';
            }, 600);
        } else if (pending.type === 'place_order') {
            // Auto submit checkout order form if on checkout page
            const form = document.getElementById('checkout-form');
            if (form) {
                if (typeof showToast === 'function') {
                    showToast('🚀 Finalizing your order...', 'primary');
                }
                const submitBtn = document.getElementById('place-order-btn');
                if (submitBtn) submitBtn.click();
            }
        }
    } catch (e) {
        console.error('Error resuming pending action:', e);
    }
}

/**
 * Updates UI header badges, account buttons, and profile info
 */
export function updateUIForAuthState(user) {
    const isAdmin = Boolean(user && user.isLoggedIn && user.email && ['rohit09ydv@gmail.com', 'admin@foodrush.com'].includes(user.email.toLowerCase()));

    // 1. Update navigation badges
    const authContainers = document.querySelectorAll('.auth-nav-container');
    authContainers.forEach(container => {
        if (user && user.isLoggedIn) {
            const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
            const adminNavBtn = isAdmin ? `
                <a href="/admin/" class="btn btn-sm" style="background: linear-gradient(135deg, #FF5722, #E64A19); color: #fff; font-weight: 700; border-radius: 20px; padding: 5px 12px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(255,87,34,0.3); font-size: 0.8rem;" title="Open Admin Control Center">
                    <i class="fa-solid fa-shield-halved"></i> Admin Panel
                </a>
            ` : '';

            container.innerHTML = `
                <div class="user-logged-in-wrap" style="display: flex; align-items: center; gap: 8px;">
                    ${adminNavBtn}
                    <a href="/auth/" class="user-profile-badge" title="My Account (${user.email})">
                        <div class="user-avatar" style="background: #4285F4; width: 34px; height: 34px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                            ${initial}
                        </div>
                        <span style="font-weight: 600; font-size: 0.9rem;">${user.name.split(' ')[0]}</span>
                    </a>
                    <button type="button" class="btn btn-outline btn-sm logout-nav-btn" style="padding: 4px 10px; font-size: 0.8rem; border-color: var(--border-color);" title="Log out">
                        <i class="fa-solid fa-arrow-right-from-bracket"></i>
                    </button>
                </div>
            `;
            const logoutBtn = container.querySelector('.logout-nav-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    signOutUser();
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

    // 2. Update auth.html session card if present
    const sessionCard = document.getElementById('logged-in-session-view');
    const authWrapper = document.querySelector('.auth-wrapper');
    if (sessionCard && authWrapper) {
        if (user && user.isLoggedIn) {
            authWrapper.style.display = 'none';
            sessionCard.style.display = 'block';

            const nameEl = document.getElementById('session-user-name');
            const emailEl = document.getElementById('session-user-email');
            const uidEl = document.getElementById('session-user-uid');
            if (nameEl) nameEl.textContent = user.name;
            if (emailEl) emailEl.innerHTML = `${user.email} <span class="badge badge-primary" style="font-size:0.75rem; margin-left: 6px;">${user.provider === 'google' ? 'Google Account' : 'Verified User'}</span>`;
            if (uidEl) uidEl.textContent = user.uid ? `User UID: ${user.uid}` : '';

            // If Admin, show big Admin Dashboard button
            let adminCardBtn = document.getElementById('session-admin-dashboard-btn');
            if (isAdmin) {
                if (!adminCardBtn) {
                    adminCardBtn = document.createElement('a');
                    adminCardBtn.id = 'session-admin-dashboard-btn';
                    adminCardBtn.href = '/admin/';
                    adminCardBtn.className = 'btn btn-primary btn-block btn-lg';
                    adminCardBtn.style.background = 'linear-gradient(135deg, #FF5722, #D84315)';
                    adminCardBtn.style.marginBottom = '12px';
                    adminCardBtn.innerHTML = '<i class="fa-solid fa-shield-halved" style="margin-right: 8px;"></i> Open Admin Dashboard (Logins & Orders)';
                    const actionsBox = sessionCard.querySelector('div[style*="flex-direction: column"]');
                    if (actionsBox) actionsBox.prepend(adminCardBtn);
                }
            } else if (adminCardBtn) {
                adminCardBtn.remove();
            }
        } else {
            authWrapper.style.display = 'block';
            sessionCard.style.display = 'none';
        }
    }

    // 3. Auto-fill checkout fields if on checkout.html
    if (user && user.isLoggedIn) {
        const nameInput = document.getElementById('full-name');
        const emailInput = document.getElementById('email');
        if (nameInput && !nameInput.value) nameInput.value = user.name;
        if (emailInput && !emailInput.value) emailInput.value = user.email;
    }
}

/**
 * Open Modal Dialog for Google Sign-in
 */
export function openGoogleAuthModal(reason = 'checkout') {
    let modal = document.getElementById('foodrush-google-auth-modal');
    if (!modal) {
        createGoogleAuthModal();
        modal = document.getElementById('foodrush-google-auth-modal');
    }

    const titleEl = document.getElementById('gauth-modal-title');
    const descEl = document.getElementById('gauth-modal-desc');

    if (reason === 'checkout' || reason === 'proceed_to_checkout' || reason === 'place_order' || reason === 'buy_now') {
        if (titleEl) titleEl.textContent = 'Sign In to Complete Order';
        if (descEl) descEl.textContent = 'Your cart & items are saved! Please sign in with your Google account to proceed with checkout.';
    } else {
        if (titleEl) titleEl.textContent = 'Sign in with Google';
        if (descEl) descEl.textContent = 'Continue to FoodRush with your verified Google account.';
    }

    if (modal) {
        modal.classList.add('active');
    }
}

export function closeGoogleAuthModal() {
    const modal = document.getElementById('foodrush-google-auth-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Create dynamic Google Auth Modal in DOM
 */
function createGoogleAuthModal() {
    if (document.getElementById('foodrush-google-auth-modal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'foodrush-google-auth-modal';
    modalDiv.className = 'modal-backdrop';
    modalDiv.innerHTML = `
        <div class="google-dialog-card" style="max-width: 440px; background: #fff; border-radius: 16px; padding: 32px 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.18); text-align: center; position: relative;">
            <button type="button" id="close-gauth-modal-x" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748B;">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <div style="width: 56px; height: 56px; background: #EEF2FF; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                <svg style="width: 28px; height: 28px;" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
            </div>

            <h3 id="gauth-modal-title" style="font-size: 1.35rem; font-weight: 700; color: #1E293B; margin-bottom: 8px;">
                Sign In to Continue
            </h3>
            <p id="gauth-modal-desc" style="font-size: 0.92rem; color: #64748B; margin-bottom: 24px; line-height: 1.5;">
                Continue with your Google account to proceed with your order.
            </p>

            <button type="button" id="gauth-modal-google-btn" class="btn-google" style="width: 100%; justify-content: center; padding: 12px; font-size: 1rem; margin-bottom: 16px;">
                <svg class="google-icon-svg" style="width: 20px; height: 20px; margin-right: 10px;" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Continue with Google
            </button>

            <div style="font-size: 0.8rem; color: #94A3B8; margin-top: 12px;">
                <i class="fa-solid fa-shield-halved" style="color: var(--success); margin-right: 4px;"></i>
                Secure Google Authentication &bull; Your cart is preserved
            </div>
        </div>
    `;

    document.body.appendChild(modalDiv);

    // Attach listeners
    document.getElementById('close-gauth-modal-x')?.addEventListener('click', closeGoogleAuthModal);
    modalDiv.addEventListener('click', (e) => {
        if (e.target === modalDiv) closeGoogleAuthModal();
    });

    document.getElementById('gauth-modal-google-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('gauth-modal-google-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting to Google...';
        }
        try {
            await signInWithGoogle();
        } catch (e) {
            // Error already toasted
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `
                    <svg class="google-icon-svg" style="width: 20px; height: 20px; margin-right: 10px;" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    Continue with Google
                `;
            }
        }
    });
}

/**
 * --- FIREBASE REAL PHONE SMS AUTHENTICATION ---
 */
let confirmationResult = null;
let recaptchaVerifier = null;

export function initRecaptchaVerifier(containerId = 'recaptcha-container') {
    if (!auth) return null;
    try {
        if (!recaptchaVerifier) {
            recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
                size: 'invisible',
                callback: () => {
                    console.log('reCAPTCHA solved');
                },
                'expired-callback': () => {
                    console.warn('reCAPTCHA expired');
                }
            });
            recaptchaVerifier.render();
        }
        return recaptchaVerifier;
    } catch (e) {
        console.warn('Recaptcha init warning:', e);
        return null;
    }
}

export async function sendPhoneOtp(rawPhoneNumber) {
    if (!auth) throw new Error('Firebase Auth is not initialized');

    // Format phone number to E.164 (e.g. +91XXXXXXXXXX)
    let cleaned = rawPhoneNumber.replace(/\D/g, '');
    if (cleaned.length === 10) {
        cleaned = '+91' + cleaned;
    } else if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }

    try {
        const verifier = initRecaptchaVerifier('recaptcha-container');
        confirmationResult = await signInWithPhoneNumber(auth, cleaned, verifier);
        console.log('📱 Real Firebase SMS OTP dispatched to:', cleaned);
        return { success: true, phoneNumber: cleaned };
    } catch (error) {
        console.error('Phone SMS dispatch error:', error);
        if (recaptchaVerifier) {
            try { recaptchaVerifier.clear(); recaptchaVerifier = null; } catch(e) {}
        }
        let msg = error.message;
        if (error.code === 'auth/operation-not-allowed') {
            msg = 'Phone authentication provider is currently disabled in Firebase Console.';
        } else if (error.code === 'auth/invalid-phone-number') {
            msg = 'Invalid phone number. Please enter a valid 10-digit number.';
        } else if (error.code === 'auth/too-many-requests') {
            msg = 'Too many requests. Please try again after some time.';
        }
        throw new Error(msg);
    }
}

export async function verifyPhoneOtp(otpCode, additionalUserData = {}) {
    if (!confirmationResult) {
        throw new Error('No pending SMS verification found. Please request a new OTP.');
    }

    try {
        const result = await confirmationResult.confirm(otpCode.trim());
        const user = result.user;

        const sessionUser = {
            name: additionalUserData.name || 'Mobile Customer',
            email: additionalUserData.email || `${user.phoneNumber.replace('+', '')}@foodrush.user`,
            phone: user.phoneNumber,
            uid: user.uid,
            provider: 'phone',
            isLoggedIn: true,
            isVerified: true
        };

        localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(sessionUser));
        updateUIForAuthState(sessionUser);

        if (typeof showToast === 'function') {
            showToast(`🎉 Phone Verified! Welcome, ${sessionUser.name}!`, 'primary');
        }

        resumePendingActionAfterLogin();
        return sessionUser;
    } catch (error) {
        console.error('Phone OTP verification error:', error);
        let msg = 'Invalid SMS OTP. Please check the code received on your phone.';
        if (error.code === 'auth/invalid-verification-code') {
            msg = 'Incorrect 6-digit code. Please enter the correct SMS code.';
        } else if (error.code === 'auth/code-expired') {
            msg = 'This SMS code has expired. Please request a new code.';
        }
        throw new Error(msg);
    }
}

// Make functions accessible globally for non-module scripts
window.FoodRushAuth = {
    getCurrentUser,
    isAuthenticated,
    signInWithGoogle,
    showGoogleAuthErrorModal,
    sendPhoneOtp,
    verifyPhoneOtp,
    signOutUser,
    requireAuth,
    openGoogleAuthModal,
    closeGoogleAuthModal,
    updateUIForAuthState
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    createGoogleAuthModal();
    updateUIForAuthState(getCurrentUser());
});
