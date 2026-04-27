import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { setDoc, doc } from 'firebase/firestore'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

interface AuthProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onBack?: () => void;
  initialIsLogin?: boolean;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onBack, initialIsLogin = true }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(initialIsLogin);

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent!");
    } catch (error: any) {
      alert(error.message);
    }
  };

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await onLogin(email, password);
      } else {
        // Just create the user. App.tsx will detect the new user and route them to ProfileSetup.
        await createUserWithEmailAndPassword(auth, email, password);
   
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="flex flex-col items-center bg-gray-900 min-h-screen text-gray-100 justify-center p-8 w-full">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          {onBack && (
            <button onClick={onBack} className="text-sm text-gray-400 hover:text-white transition-colors">
              &larr; Back
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} className="bg-gray-900 border border-gray-700 text-white p-3 rounded-lg focus:outline-none focus:border-blue-500" />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} className="bg-gray-900 border border-gray-700 text-white p-3 rounded-lg focus:outline-none focus:border-blue-500" />
          <button
          type="button"
          onClick={handleForgotPassword}
          className="text-xs text-blue-500 hover:underline text-left"
        >
          Forgot Password?
        </button>
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 transition-colors text-white p-3 rounded-lg font-medium mt-2">
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="mt-4 text-green-600 hover:underline"
        >
          {isLogin ? "Need an account? Sign Up" : "Already have an account? Login"}
        </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;