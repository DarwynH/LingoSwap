
import React, { useState } from 'react';
import { UserProfile, Language } from '../types';
import { auth, db } from '../firebase';
import { updatePassword, deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';

interface ProfileSetupProps {
  profile: UserProfile;
  onSave: (updated: UserProfile) => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ profile, onSave }) => {
  const [name, setName] = useState(profile.name);
  const [native, setNative] = useState<Language>(profile.nativeLanguage || Language.ENGLISH);
  const [target, setTarget] = useState<Language>(profile.targetLanguage || Language.SPANISH);
  const [bio, setBio] = useState(profile.bio || "");
  const [newPassword, setNewPassword] = useState("");

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

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault(); // Stop any default browser behavior
    onSave({
      ...profile,
      name,
      nativeLanguage: native,
      targetLanguage: target,
      bio: bio || ""
    });
  };

  return (
    <div className="flex-1 p-8 bg-white overflow-y-auto">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Complete Your Profile</h2>
      <div className="space-y-6">
        <div className="flex justify-center mb-4">
            <img src={profile.avatar} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-[#00a884]" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Display Name</label>
          <input 
            type="text" 
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Native Language</label>
            <select 
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:outline-none bg-white"
              value={native}
              onChange={(e) => setNative(e.target.value as Language)}
            >
              {Object.values(Language).map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Learning</label>
            <select 
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:outline-none bg-white"
              value={target}
              onChange={(e) => setTarget(e.target.value as Language)}
            >
              {Object.values(Language).map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Bio</label>
          <textarea 
            rows={3}
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:outline-none"
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

        <div className="pt-8 mt-4 border-t border-gray-200">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Account Management</h3>
          
          {isPasswordUser && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h4 className="font-semibold text-gray-700 mb-2">Change Password</h4>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleChangePassword}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Update
                </button>
              </div>
            </div>
          )}

          <div className="p-4 border border-red-100 rounded-lg bg-red-50">
            <h4 className="font-semibold text-red-700 mb-2">Danger Zone</h4>
            <p className="text-sm text-red-600 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
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
