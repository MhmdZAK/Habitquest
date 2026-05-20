import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyCjHLziyivX0_j82Nn44aXmefCS-eGnAeA",
  authDomain: "habit-quest-2f538.firebaseapp.com",
  projectId: "habit-quest-2f538",
  storageBucket: "habit-quest-2f538.firebasestorage.app",
  messagingSenderId: "578728685240",
  appId: "1:578728685240:web:69781a64e19508cfc48e4d"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);