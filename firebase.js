import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCZ4qITUFY8tAwXXR_m_EDgVjVlO1-nogk",
  authDomain: "fragmint6.firebaseapp.com",
  projectId: "fragmint6",
  storageBucket: "fragmint6.firebasestorage.app",
  messagingSenderId: "329787383150",
  appId: "1:329787383150:web:f152603f44f2d5e715357f",
  measurementId: "G-4Z1Q9QWR21"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
