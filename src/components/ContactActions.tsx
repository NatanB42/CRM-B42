import React from 'react';
import { Mail, Phone, Instagram } from 'lucide-react';
import { Contact } from '../types';

interface ContactActionsProps {
  contact: Contact;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ContactActions: React.FC<ContactActionsProps> = ({ 
  contact, 
  size = 'md',
  className = ''
}) => {
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const iconSize = iconSizes[size];

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contact.email) {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${contact.email}`, '_blank');
    }
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (contact.phone) {
      const cleanPhone = contact.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    }
  };

  const handleInstagramClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const instagram = contact.instagram;
    if (instagram) {
      // Remove @ if present and clean the username
      const username = instagram.replace('@', '').trim();
      window.open(`https://www.instagram.com/${username}`, '_blank');
    }
  };

  // Check which actions are available
  const hasEmail = contact.email && contact.email.trim() !== '';
  const hasPhone = contact.phone && contact.phone.trim() !== '';
  const hasInstagram = contact.instagram && contact.instagram.trim() !== '';

  // Don't render anything if no actions are available
  if (!hasEmail && !hasPhone && !hasInstagram) {
    return null;
  }

  return (
    <div className={`flex space-x-2 ${className}`}>
      {hasEmail && (
        <button
          onClick={handleEmailClick}
          className="text-gray-400 hover:text-indigo-600 transition-colors"
          title={`Enviar email para ${contact.email}`}
        >
          <Mail className={iconSize} />
        </button>
      )}
      
      {hasPhone && (
        <button
          onClick={handlePhoneClick}
          className="text-gray-400 hover:text-green-600 transition-colors"
          title={`WhatsApp: ${contact.phone}`}
        >
          <Phone className={iconSize} />
        </button>
      )}
      
      {hasInstagram && (
        <button
          onClick={handleInstagramClick}
          className="text-gray-400 hover:text-pink-600 transition-colors"
          title={`Instagram: ${contact.instagram}`}
        >
          <Instagram className={iconSize} />
        </button>
      )}
    </div>
  );
};

export default ContactActions;