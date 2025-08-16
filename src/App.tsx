import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { usePlaidLink } from 'react-plaid-link';

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
const appId: string = (typeof __app_id !== 'undefined' ? __app_id : 'local-dev-app-id') as string;
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
// initializeApp(firebaseConfig);
// Utility to generate a unique ID for unauthenticated users (for future use)
// const generateAnonymousUserId = (): string => {
//   let id = localStorage.getItem('anonymousUserId');
//   if (!id) {
//     id = crypto.randomUUID();
//     localStorage.setItem('anonymousUserId', id);
//   }
//   return id;
// };

// IMPORTANT: Replace with your actual API Gateway Invoke URL
const API_GATEWAY_URL = "https://3h8060ngd5.execute-api.us-east-1.amazonaws.com/dev";

function App() {
  // State variables with explicit TypeScript types
  const [db, setDb] = useState<Firestore | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryLimit, setNewCategoryLimit] = useState<string>(''); // Keep as string for input, parse later
  const [message, setMessage] = useState<string>('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);

  // Plaid integration state
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isPlaidLoading, setIsPlaidLoading] = useState<boolean>(false);


  // Initialize Firebase and set up auth listener
  useEffect(() => {
    try {
      if (!firebaseConfig || !('projectId' in firebaseConfig) || !firebaseConfig.projectId) {
        throw new Error("Firebase 'projectId' not provided in configuration. Ensure .env.local is set up or Canvas variables are present.");
      }
      
      const app: FirebaseApp = initializeApp(firebaseConfig);
      const firestore: any = getFirestore(app);
      const firebaseAuth: any = getAuth(app);

      setDb(firestore);

      onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          // User is signed in, see docs for a list of available properties
          // https://firebase.google.com/docs/reference/js/firebase.User
          setUserId(user.uid);
          setIsAuthReady(true);
        } else {
          // User is signed out
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
              await signInAnonymously(firebaseAuth);
            }
            // onAuthStateChanged will be called again with the new user
          } catch (error) {
            console.error("Error during sign-in:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setMessage(`Error during sign-in: ${errorMessage}.`);
            // If sign-in fails, we can't proceed.
            setIsAuthReady(true); // Set to true to stop showing the loading screen
          }
        }
      });
    } catch (error: any) { // Use 'any' for error type if not specific
      console.error("Error initializing Firebase:", error);
      setMessage(`Error initializing app: ${error.message || 'Unknown error'}. Please check console for details.`);
    }
  }, []);

  // Fetch Plaid Link token when auth is ready
  useEffect(() => {
    if (isAuthReady && userId && !linkToken && !isPlaidLoading) {
      const getLinkToken = async () => {
        setIsPlaidLoading(true);
        try {
          const response = await fetch(`${API_GATEWAY_URL}/link-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId }),
          });
          if (!response.ok) throw new Error('Failed to fetch link token.');
          const data = await response.json();
          setLinkToken(data.link_token);
          setMessage("Link token fetched. Ready to connect bank account.");
        } catch (error: any) {
          console.error("Error fetching link token:", error);
          setMessage(`Error fetching link token: ${error.message}`);
        } finally {
          setIsPlaidLoading(false);
        }
      };
      getLinkToken();
    }
  }, [isAuthReady, userId]);

  // Fetch categories when auth is ready
  useEffect(() => {
    if (db && userId && isAuthReady) {
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

      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady]);

  // Plaid Link integration using the hook
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, _metadata) => {
      setMessage("Bank account connected! Exchanging public token for access token...");
      try {
        const response = await fetch(`${API_GATEWAY_URL}/exchange-public-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken, userId: userId }),
        });
        if (!response.ok) throw new Error('Failed to exchange public token.');
        setMessage("Access token saved to your database successfully!");
      } catch (err: any) {
        console.error("Error exchanging public token:", err);
        setMessage(`Error exchanging public token: ${err.message}`);
      }
    },
    onExit: (err, metadata) => {
      console.log('Plaid Link exited:', err, metadata);
      setMessage("Plaid Link flow was exited.");
    },
    onEvent: (eventName, metadata) => {
      console.log('Plaid Link event:', eventName, metadata);
    },
  });

  const handleAddCategory = async (): Promise<void> => {
    const parsedLimit = parseFloat(newCategoryName);
    if (!newCategoryName.trim() || isNaN(parsedLimit) || parsedLimit <= 0) {
      setMessage("Please enter a valid category name and a positive numeric limit.");
      return;
    }

    if (!db || !userId) {
      setMessage("Database not initialized or user not authenticated.");
      return;
    }

    try {
      const categoryDocId = newCategoryName.toLowerCase().replace(/\s+/g, '-');
      const categoryData: Omit<Category, 'id'> = {
        name: newCategoryName.trim(),
        weeklyLimit: parsedLimit,
        currentWeekSpending: 0,
        lastUpdated: new Date().toISOString(),
      };
      const categoriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/categories`);
      
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
    const newLimitStr: string | null = prompt(`Enter new weekly limit for ${categoryId}:`, currentLimit.toString());
    
    if (newLimitStr === null) {
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
      await setDoc(categoryDocRef, { weeklyLimit: newLimit, lastUpdated: new Date().toISOString() }, { merge: true });
      setMessage(`Limit for "${categoryId}" updated successfully!`);
    } catch (error: any) {
      console.error("Error updating limit:", error);
      setMessage(`Error updating limit: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  // Future function for backend integration
  // const fetchAndCategorizeTransactions = async (): Promise<void> => {
  //   setMessage("Fetching and categorizing transactions (backend integration needed)...");
  //   // In a real application, this would trigger a backend Lambda function
  //   // that connects to Plaid, fetches transactions, categorizes them,
  //   // and updates the 'currentWeekSpending' for each category in Firestore.
  //   // For now, we'll just simulate a message.
  // };

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

        <div className="mt-8 pt-6 border-t border-gray-200 text-center space-y-4">
          <button
            onClick={() => open()}
            disabled={!ready || linkToken === null}
            className={`font-bold py-3 px-6 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105
              ${ready && linkToken !== null
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-400 text-gray-700 cursor-not-allowed'
              }`}
          >
            Connect a Bank Account
          </button>
          <p className="text-sm text-gray-500 mt-2">
            (The "Connect a Bank Account" button will be active once the backend responds with a link token.)
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
