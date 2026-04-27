import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { setDoc, doc } from 'firebase/firestore';
import { 
  sendPasswordResetEmail, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

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
    if (!email.trim()) {
      alert("Please enter your email first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert("Password reset email sent!");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // App.tsx onAuthStateChanged will handle routing
    } catch (error: any) {
      if (error.code === 'auth/account-exists-with-different-credential') {
        alert("An account already exists with the same email address but different sign-in credentials.");
      } else {
        alert(error.message);
      }
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
      if (error.code === 'auth/email-already-in-use') {
        alert("This email is already in use. If you signed up with Google, please use Continue with Google.");
      } else {
        alert(error.message);
      }
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

          <div className="flex items-center my-4">
            <div className="flex-grow border-t border-gray-700"></div>
            <span className="px-3 text-sm text-gray-500">or</span>
            <div className="flex-grow border-t border-gray-700"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center space-x-3 bg-white text-gray-900 hover:bg-gray-100 transition-colors p-3 rounded-lg font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continue with Google</span>
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