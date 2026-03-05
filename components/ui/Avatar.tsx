
import React from 'react';

interface AvatarProps {
  src: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ src, size = 'md', online, className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-24 h-24'
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <img 
        src={src} 
        alt="Avatar" 
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-white shadow-sm`}
      />
      {online && (
        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
      )}
    </div>
  );
};

export default Avatar;
