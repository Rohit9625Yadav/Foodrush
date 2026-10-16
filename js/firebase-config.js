/**
 * FoodRush - Official Firebase Configuration
 * Connected to Real Firebase Project: foodrush-ebb13
 */

// Automatically normalize 127.0.0.1 to localhost so VS Code Go Live seamlessly uses Firebase's default whitelist
if (typeof window !== 'undefined' && window.location && window.location.hostname === '127.0.0.1') {
    const targetUrl = window.location.href.replace('127.0.0.1', 'localhost');
    window.location.replace(targetUrl);
}

window.firebaseConfig = {
  apiKey: "AIzaSyDQ9aOT37aC2hB62_Wnu3UzadgZsiytFIw",
  authDomain: "foodrush-ebb13.firebaseapp.com",
  projectId: "foodrush-ebb13",
  storageBucket: "foodrush-ebb13.firebasestorage.app",
  messagingSenderId: "880275573919",
  appId: "1:880275573919:web:9564befd2a64deae1c26aa",
  measurementId: "G-WE331ZZ280"
};
