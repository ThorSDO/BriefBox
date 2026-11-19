import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAs5Tqf2fPfM-SPFpY2xtNqeyOoOtp92ZY',
  authDomain: 'briefbox-art-2026.firebaseapp.com',
  projectId: 'briefbox-art-2026',
  storageBucket: 'briefbox-art-2026.firebasestorage.app',
  messagingSenderId: '487257396166',
  appId: '1:487257396166:web:2558005473144a5026d8c7',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
