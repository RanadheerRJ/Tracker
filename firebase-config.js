// Firebase web configuration — this is the only client configuration file.
// Firebase API keys identify a web project and are safe to ship in a browser app;
// Firestore Security Rules are the security boundary. Do not put server secrets here.
export const firebaseConfig = {
  apiKey: "AIzaSyCiA6ZLH7mF0AKolARUQlVuc0gXG2K53iI",
  authDomain: "rare-inventory.firebaseapp.com",
  projectId: "rare-inventory",
  storageBucket: "rare-inventory.firebasestorage.app",
  messagingSenderId: "1040851101163",
  appId: "1:1040851101163:web:af54f184ad945f203365ae",
  measurementId: "G-J88K8SZ9MT"
};

// Keep this value identical to the one in firestore.rules.
// Replace only after registering your first Chrona account and copying its Auth UID.
export const ADMIN_UID = "2IK84bj7G8MUknA513sElThOQB42";
