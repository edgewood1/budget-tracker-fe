import React, { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, setDoc, Firestore } from 'firebase/firestore';

// Define an interface for the Category data structure
interface Category {
  id: string;
  name: string;
  weeklyLimit: number;
  currentWeekSpending: number;
  lastUpdated: string; // ISO string for date
}

// Declare global variables provided by the Canvas environment
declare const __app_id: string | undefined;
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;

// Using type assertions for __app_id, __firebase_config, __initial_auth_token
const appId: string = (typeof __app_id !== 'undefined' ? __app_id : 'default-app-id') as string;
// const firebaseConfig: object = (typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {}) as object;
const initialAuthToken: string | null = (typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null) as string | null;


// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Utility to generate a unique ID for unauthenticated users
const generateAnonymousUserId = (): string => {
  let id = localStorage.getItem('anonymousUserId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('anonymousUserId', id);
  }
  return id;
};

function App() {
  // State variables with explicit TypeScript types
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryLimit, setNewCategoryLimit] = useState<string>(''); // Keep as string for input, parse later
  const [message, setMessage] = useState<string>('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);

  // Initialize Firebase and set up auth listener
  useEffect(() => {
    try {
      const app: FirebaseApp = initializeApp(firebaseConfig);
      const firestore: Firestore = getFirestore(app);
      const firebaseAuth: Auth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Sign in anonymously if no initial token or user
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
          // After anonymous sign-in, onAuthStateChanged will be called again with the anonymous user
          // For now, if no user, we'll use a local anonymous ID for data scoping
          setUserId(firebaseAuth.currentUser?.uid || generateAnonymousUserId());
        }
        setIsAuthReady(true);
      });
    } catch (error: any) { // Use 'any' for error type if not specific
      console.error("Error initializing Firebase:", error);
      setMessage(`Error initializing app: ${error.message || 'Unknown error'}. Please check console for details.`);
    }
  }, []);

  // Fetch categories when auth is ready
  useEffect(() => {
    if (db && userId && isAuthReady) {
      // Construct the collection path including appId and userId for proper scoping
      const categoriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/categories`);
      const q = query(categoriesCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedCategories: Category[] = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name as string,
          weeklyLimit: doc.data().weeklyLimit as number,
          currentWeekSpending: doc.data().currentWeekSpending as number,
          lastUpdated: doc.data().lastUpdated as string,
        }));
        setCategories(fetchedCategories);
      }, (error: any) => {
        console.error("Error fetching categories:", error);
        setMessage(`Error fetching categories: ${error.message || 'Unknown error'}. Please try again.`);
      });

      return () => unsubscribe(); // Cleanup listener on unmount
    }
  }, [db, userId, isAuthReady]); // Dependencies for useEffect

  const handleAddCategory = async (): Promise<void> => {
    const parsedLimit = parseFloat(newCategoryLimit);
    if (!newCategoryName.trim() || isNaN(parsedLimit) || parsedLimit <= 0) {
      setMessage("Please enter a valid category name and a positive numeric limit.");
      return;
    }

    if (!db || !userId) {
      setMessage("Database not initialized or user not authenticated.");
      return;
    }

    try {
      // Firestore document ID will be a lowercase, hyphenated version of the category name
      const categoryDocId = newCategoryName.toLowerCase().replace(/\s+/g, '-');
      const categoryData: Omit<Category, 'id'> = { // Omit 'id' as it's the doc ID
        name: newCategoryName.trim(),
        weeklyLimit: parsedLimit,
        currentWeekSpending: 0, // Initialize spending to 0
        lastUpdated: new Date().toISOString(),
      };
      const categoriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/categories`);
      
      // Set the document with the derived ID
      await setDoc(doc(categoriesCollectionRef, categoryDocId), categoryData);
      setMessage(`Category "${newCategoryName}" added successfully!`);
      setNewCategoryName('');
      setNewCategoryLimit('');
      setShowAddCategoryModal(false);
    } catch (error: any) {
      console.error("Error adding category:", error);
      setMessage(`Error adding category: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleUpdateLimit = async (categoryId: string, currentLimit: number): Promise<void> => {
    // Using window.prompt for simplicity, but for production, use a custom modal
    const newLimitStr: string | null = prompt(`Enter new weekly limit for ${categoryId}:`, currentLimit.toString());
    
    if (newLimitStr === null) { // User cancelled the prompt
      return;
    }

    const newLimit = parseFloat(newLimitStr);
    if (isNaN(newLimit) || newLimit <= 0) {
      setMessage("Invalid limit entered. Please enter a positive numeric value.");
      return;
    }

    if (!db || !userId) {
      setMessage("Database not initialized or user not authenticated.");
      return;
    }

    try {
      const categoryDocRef = doc(db, `artifacts/${appId}/users/${userId}/categories`, categoryId);
      // Use setDoc with { merge: true } to only update the weeklyLimit field
      await setDoc(categoryDocRef, { weeklyLimit: newLimit, lastUpdated: new Date().toISOString() }, { merge: true });
      setMessage(`Limit for "${categoryId}" updated successfully!`);
    } catch (error: any) {
      console.error("Error updating limit:", error);
      setMessage(`Error updating limit: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  // Placeholder for future transaction fetching and categorization
  const fetchAndCategorizeTransactions = async (): Promise<void> => {
    setMessage("Fetching and categorizing transactions (backend integration needed)...");
    // In a real application, this would trigger a backend Lambda function
    // that connects to Plaid, fetches transactions, categorizes them,
    // and updates the 'currentWeekSpending' for each category in Firestore.
    // For now, we'll just simulate a message.
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading application...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 font-sans">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-3xl border border-gray-200">
        <h1 className="text-4xl font-extrabold text-center text-gray-900 mb-8">
          Personal Budget Tracker
        </h1>

        <div className="text-center text-sm text-gray-600 mb-4">
          Your User ID: <span className="font-mono bg-gray-200 px-2 py-1 rounded text-xs">{userId}</span>
        </div>

        {message && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-6 text-center" role="alert">
            <span className="block sm:inline">{message}</span>
          </div>
        )}

        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Your Categories</h2>
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Add New Category
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-center text-gray-600 text-lg">No categories added yet. Click "Add New Category" to get started!</p>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => {
              const remaining: number = category.weeklyLimit - category.currentWeekSpending;
              const isOverBudget: boolean = remaining < 0;
              const progressPercentage: number = (category.currentWeekSpending / category.weeklyLimit) * 100;

              return (
                <div
                  key={category.id}
                  className={`bg-gray-50 p-6 rounded-xl shadow-sm border ${isOverBudget ? 'border-red-400' : 'border-blue-200'}`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-semibold text-gray-800">{category.name}</h3>
                    <button
                      onClick={() => handleUpdateLimit(category.id, category.weeklyLimit)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm transition duration-200"
                    >
                      Update Limit
                    </button>
                  </div>

                  <div className="mb-2">
                    <p className="text-gray-700">
                      Weekly Limit: <span className="font-bold text-lg">${category.weeklyLimit.toFixed(2)}</span>
                    </p>
                    <p className="text-gray-700">
                      Current Spending: <span className="font-bold text-lg">${category.currentWeekSpending.toFixed(2)}</span>
                    </p>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                    <div
                      className={`h-2.5 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, progressPercentage)}%` }}
                    ></div>
                  </div>

                  <p className={`text-lg font-bold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                    Remaining: ${remaining.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Category Modal */}
        {showAddCategoryModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Category</h2>
              <div className="mb-4">
                <label htmlFor="categoryName" className="block text-gray-700 text-sm font-bold mb-2">Category Name:</label>
                <input
                  type="text"
                  id="categoryName"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={newCategoryName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Groceries"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="categoryLimit" className="block text-gray-700 text-sm font-bold mb-2">Weekly Budget Limit ($):</label>
                <input
                  type="number"
                  id="categoryLimit"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={newCategoryLimit}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCategoryLimit(e.target.value)}
                  placeholder="e.g., 100.00"
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowAddCategoryModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCategory}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300"
                >
                  Add Category
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <button
            onClick={fetchAndCategorizeTransactions}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
          >
            Simulate Fetch & Categorize Transactions
          </button>
          <p className="text-sm text-gray-500 mt-2">
            (This button currently only shows a message; backend integration is required for full functionality.)
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
