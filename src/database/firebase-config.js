// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAfZMnudMNY3JfURpbN0HXyVjg7pfkZREA",
  authDomain: "exakt-arcade.firebaseapp.com",
  databaseURL: "https://exakt-arcade-default-rtdb.firebaseio.com",
  projectId: "exakt-arcade",
  storageBucket: "exakt-arcade.firebasestorage.app",
  messagingSenderId: "381687942957",
  appId: "1:381687942957:web:84d0f904c12894a5108da4",
  measurementId: "G-VLLS681ZGM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };