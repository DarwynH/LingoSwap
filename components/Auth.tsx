import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { setDoc, doc } from 'firebase/firestore'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

interface AuthProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

// 2. Add the prop to the component
const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

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
    <div className="flex flex-col items-center p-8">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} className="border p-2" />
        <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} className="border p-2" />
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-xs text-blue-500 hover:underline text-left"
        >
          Forgot Password?
        </button>
        <button type="submit" className="bg-blue-500 text-white p-2">
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
  );
};

export default Auth;