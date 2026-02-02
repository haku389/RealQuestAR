// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp, getApps } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC2r5pGGwTESkBIBWSMYjKqUE-C03df6D0",
  authDomain: "realquestar-a24bd.firebaseapp.com",
  projectId: "realquestar-a24bd",
  storageBucket: "realquestar-a24bd.firebasestorage.app",
  messagingSenderId: "423431010116",
  appId: "1:423431010116:web:c94a10f3c9c95872294911",
  measurementId: "G-RH421GLTHE"
};

// Initialize Firebase
export const firebaseApp =
  getApps().length ? getApps()[0] : initializeApp(firebaseConfig);