import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import React, { useState, useEffect } from 'react'; // Added useState and useEffect
import { UserProfile } from '../types';
import PartnerCard from './Dashboard/PartnerCard';

interface FindPartnersProps {
  user: UserProfile;
  onStartChat: (partner: UserProfile, chatId: string) => void;
}

const FindPartners: React.FC<FindPartnersProps> = ({ user, onStartChat }) => {
  const [realPartners, setRealPartners] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getPartners = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const list = querySnapshot.docs
          .map(doc => doc.data() as UserProfile)
          .filter(p => p.id !== user.id);
        setRealPartners(list);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    getPartners();
  }, [user.id]);

  // Logic to separate "Perfect Matches" from "Global Community"
  const suggestedPartners = realPartners.filter(p =>
    p.nativeLanguage === user.targetLanguage &&
    p.targetLanguage === user.nativeLanguage
  );

  const otherPartners = realPartners.filter(p => !suggestedPartners.includes(p));

  if (loading) return <div className="p-8 text-center text-gray-500">Loading partners...</div>;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafb]">
      <header className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold text-gray-800">Find Partners</h1>
        <p className="text-xs text-gray-500">Connect with native speakers from around the world.</p>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Perfect Matches</h3>
            <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Recommended</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestedPartners.length > 0 ? suggestedPartners.map(partner => (
              // Inside the map where you render PartnerCard
              <PartnerCard
                key={partner.id}
                partner={partner}
                onClick={() => {
                  const chatId = [user.id, partner.id].sort().join('_');
                  onStartChat(partner, chatId);
                }}
              />
            )) : (
              <p className="text-sm text-gray-400 italic col-span-2">No reciprocal matches found yet.</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">Global Community</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherPartners.map(partner => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onClick={() => {
                  const chatId = [user.id, partner.id].sort().join('_');
                  onStartChat(partner, chatId);
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default FindPartners;