import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// 1. Додаємо імпорт Auth
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAo3Nc9d75xjKepKPgRLD6LWUop57n4AY8",
  authDomain: "bytnaklic.firebaseapp.com",
  projectId: "bytnaklic",
  storageBucket: "bytnaklic.appspot.com",
  messagingSenderId: "140160440367",
  appId: "1:140160440367:web:af08e5ac2581cea9900eda"
};

const app = initializeApp(firebaseConfig);

// 2. Експортуємо базу та авторизацію
export const db = getFirestore(app);
export const auth = getAuth(app);