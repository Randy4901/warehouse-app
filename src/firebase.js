import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCYZ98pRxSZUM8R4fbUfJ_pk3RRYETBWq8",
  authDomain: "warehouse-system-987c5.firebaseapp.com",
  projectId: "warehouse-system-987c5",
  storageBucket: "warehouse-system-987c5.firebasestorage.app",
  messagingSenderId: "514383844211",
  appId: "1:514383844211:web:e86b28d50efce46da4eb06",
  measurementId: "G-4M2R5C9RQY"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);