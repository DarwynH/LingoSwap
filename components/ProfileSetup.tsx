
import React, { useState } from 'react';
import { UserProfile, Language } from '../types';

interface ProfileSetupProps {
  profile: UserProfile;
  onSave: (updated: UserProfile) => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ profile, onSave }) => {
  const [name, setName] = useState(profile.name);
  const [native, setNative] = useState<Language>(profile.nativeLanguage || Language.ENGLISH);
  const [target, setTarget] = useState<Language>(profile.targetLanguage || Language.SPANISH);
  const [bio, setBio] = useState(profile.bio || "");

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
      </div>
    </div>
  );
};

export default ProfileSetup;
