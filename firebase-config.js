import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDWBe_sX4GSes9RyvMRDUjw0O5U75z7ArE",
    authDomain: "meu-gerenciador-225eb.firebaseapp.com",
    projectId: "meu-gerenciador-225eb",
    storageBucket: "meu-gerenciador-225eb.firebasestorage.app",
    messagingSenderId: "493667661568",
    appId: "1:493667661568:web:7634c39a36af27026da5e5",
    measurementId: "G-VPMLFYV95X"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);