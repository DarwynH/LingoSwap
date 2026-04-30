
import React, { useState } from 'react';
import { UserProfile, Language } from '../types';
import { auth, db } from '../firebase';
import { updatePassword, deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { getLevelInfo } from '../services/gamificationService';
import LevelBadge from './ui/LevelBadge';

interface ProfileSetupProps {
  profile: UserProfile;
  onSave: (updated: UserProfile) => void;
  onLogout?: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ profile, onSave }) => {
  const [name, setName] = useState(profile.name);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [bio, setBio] = useState(profile.bio || "");
  const [newPassword, setNewPassword] = useState("");

  const [native, setNative] = useState<Language[]>(
    Array.isArray(profile.nativeLanguage) ? profile.nativeLanguage : [Language.SELECT]
  );
  const [target, setTarget] = useState<Language[]>(
    Array.isArray(profile.targetLanguage) ? profile.targetLanguage : [Language.SELECT]
  );

  const isPasswordUser = auth.currentUser?.providerData.some(p => p.providerId === 'password');

  const handleChangePassword = async () => {
    if (!auth.currentUser || !newPassword) return;
    try {
      await updatePassword(auth.currentUser, newPassword);
      alert("Password updated successfully!");
      setNewPassword("");
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert("For your security, please log out and log back in before changing your password.");
      } else {
        alert(error.message);
      }
    }
  };

  const addNative = () => setNative([...native, Language.SELECT]);
  const addTarget = () => setTarget([...target, Language.SELECT]);

  const updateNative = (index: number, lang: Language) => {
    const newNative = [...native];
    newNative[index] = lang;
    setNative(newNative);
  };

  const updateTarget = (index: number, lang: Language) => {
    const newTarget = [...target];
    newTarget[index] = lang;
    setTarget(newTarget);
  };
  
  const removeLastNative = () => {
    if (native.length > 1) {
      setNative(native.slice(0, -1));
    }
  };

  const removeLastTarget = () => {
    if (target.length > 1) {
      setTarget(target.slice(0, -1));
    }
  }; 

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    const confirmed = window.confirm("Are you sure you want to delete your account? This action cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'users', profile.id));
      await deleteUser(auth.currentUser);
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert("For your security, please log out and log back in before deleting your account.");
      } else {
        alert(error.message);
      }
    }
  };

  const handleSave = (e: React.MouseEvent) => 
  {
    e.preventDefault();
    onSave({
      ...profile,
      name,
      nativeLanguage: native,
      targetLanguage: target,
      bio: bio || ""
    });
  };

  const toggleTheme = () => {
    const nextTheme = !isDarkMode ? 'dark' : 'light';
    setIsDarkMode(!isDarkMode);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="flex-1 p-8 bg-surface-main overflow-y-auto">
      <h2 className="text-3xl font-bold mb-6 text-theme-text">Complete Your Profile</h2>
      <div className="space-y-6">
        <div className="flex flex-col items-center mb-4 gap-2">
            <img src={profile.avatar} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-[#00a884]" />
            <LevelBadge level={getLevelInfo(profile.xp || 0)} size="md" showXP xp={profile.xp || 0} />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-theme-muted">Name</label>
          <input 
            type="text" 
            className="mt-1 w-full p-3 border border-theme-border rounded-lg bg-surface-card text-theme-text focus:ring-2 focus:ring-[#00a884] focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/*Left*/}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-300">Native</label>
            <div className="space-y-2">
              {native.map((lang, index) => (
                
                <select
                  key={`native-${index}`}
                  value={lang}              
                  className={`w-full p-2 bg-gray-800 rounded border border-gray-600 focus:outline-none 
                    ${lang === Language.SELECT ? 'text-gray-500 italic' : 'text-white'}`}
                  onChange={(e) => updateNative(index, e.target.value as Language)}
                >
                  {Object.values(Language)
                    .filter((l) => l === Language.SELECT || l === lang || !native.includes(l))
                    .map((l) => (
                      <option
                        key={l}
                        value={l}
                        disabled={l === Language.SELECT}
                        className="bg-gray-800 text-white not-italic" // Reset style for the list
                      >
                        {l}
                      </option>
                    ))}
                </select>
              ))}
            </div>

            <div className="flex justify-between items-center mt-2">
              <button type="button" onClick={addNative} className="text-sm text-blue-400 hover:text-blue-300">
                + Add Language
              </button>
              {native.length > 1 && (
                <button type="button" onClick={removeLastNative} className="text-sm text-red-500 hover:text-red-400 italic">
                  - Remove
                </button>
              )}
            </div>
          </div>

          {/*Right*/}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-300">Target</label>
            <div className="space-y-2">
              {target.map((lang, index) => (
                <select
                  key={`target-${index}`}
                  value={lang}
                  /* 1. Add the dynamic template literal here */
                  className={`w-full p-2 bg-gray-800 rounded border border-gray-600 focus:outline-none 
                    ${lang === Language.SELECT ? 'text-gray-500 italic' : 'text-white'}`}
                  onChange={(e) => updateTarget(index, e.target.value as Language)}
                >
                  {Object.values(Language)
                    .filter((l) => l === Language.SELECT || l === lang || !target.includes(l))
                    .map((l) => (
                      <option
                        key={l}
                        value={l}
                        disabled={l === Language.SELECT}
                        /* 2. Reset the style for the actual list options */
                        className="bg-gray-800 text-white not-italic"
                      >
                        {l}
                      </option>
                    ))}
                </select>
              ))}
            </div>

            <div className="flex justify-between items-center mt-2">
              <button type="button" onClick={addTarget} className="text-sm text-blue-400 hover:text-blue-300">
                + Add Language
              </button>
              {target.length > 1 && (
                <button type="button" onClick={removeLastTarget} className="text-sm text-red-500 hover:text-red-400 italic">
                  - Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-theme-muted">Bio</label>
          <textarea 
            rows={3}
            className="mt-1 w-full p-3 border border-theme-border rounded-lg bg-surface-card text-theme-text focus:ring-2 focus:ring-[#00a884] focus:outline-none"
            placeholder="Tell us a bit about yourself..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full bg-[#00a884] text-white font-bold p-4 rounded-xl shadow-lg hover:bg-[#008f70] transition-all"
        >
          Save & Discover Partners
        </button>

        <div className="pt-8 mt-4 border-t border-theme-border">
          <h3 className="text-xl font-bold mb-4 text-theme-text">Preferences</h3>
          
          <div className="mb-6 p-4 border border-theme-border rounded-lg bg-surface-card flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-theme-text">Dark Mode</h4>
              <p className="text-sm text-theme-muted">Switch between light and dark themes</p>
            </div>
            <button 
              type="button"
              onClick={toggleTheme}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-[#00a884]' : 'bg-gray-300'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <h3 className="text-xl font-bold mb-4 text-theme-text mt-8">Account Management</h3>
          
          {isPasswordUser && (
            <div className="mb-6 p-4 border border-theme-border rounded-lg bg-surface-card">
              <h4 className="font-semibold text-theme-text mb-2">Change Password</h4>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 p-2 border border-theme-border bg-surface-main text-theme-text rounded-lg focus:ring-2 focus:ring-[#00a884] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleChangePassword}
                  className="bg-[#0f172a] dark:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
                >
                  Update
                </button>
              </div>
            </div>
          )}

          {onLogout && (
            <div className="mb-6 p-4 border border-theme-border rounded-lg bg-surface-card flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-theme-text">Session</h4>
                <p className="text-sm text-theme-muted">Log out of your current session</p>
              </div>
              <button 
                type="button"
                onClick={onLogout}
                className="bg-gray-800 text-red-500 border border-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}

          <div className="p-4 border border-red-900/30 dark:border-red-500/30 rounded-lg bg-red-50 dark:bg-red-900/10">
            <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">Danger Zone</h4>
            <p className="text-sm text-red-600 dark:text-red-300 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
