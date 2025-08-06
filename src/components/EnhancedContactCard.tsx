import React from 'react';
import { Loader2, AlertTriangle, RotateCcw, X } from 'lucide-react';
import { Contact } from '../types';
import ContactActions from './ContactActions';

interface EnhancedContactCardProps {
  contact: Contact;
  list?: any;
  agent?: any;
  tags: any[];
  selectedList: any;
  isMoving: boolean;
  hasFailed: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, contact: Contact) => void;
  onDragEnd: () => void;
  onTouchStart: (e: React.TouchEvent, contact: Contact) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onClick: (contact: Contact) => void;
  onRetryMove?: () => void;
  onCancelMove?: () => void;
}

const EnhancedContactCard: React.FC<EnhancedContactCardProps> = ({
  contact,
  list,
  agent,
  tags,
  selectedList,
  isMoving,
  hasFailed,
  isDragging,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onClick,
  onRetryMove,
  onCancelMove
}) => {
  const getCardClassName = () => {
    let baseClass = "bg-white rounded-lg p-3 shadow-sm border transition-all select-none relative";
    
    if (isDragging) {
      return `${baseClass} opacity-50 scale-105 rotate-2 z-50 cursor-grabbing border-indigo-300`;
    }
    
    if (isMoving) {
      return `${baseClass} border-blue-300 bg-blue-50 cursor-wait`;
    }
    
    if (hasFailed) {
      return `${baseClass} border-red-300 bg-red-50 animate-pulse`;
    }
    
    return `${baseClass} border-gray-200 hover:shadow-md cursor-grab hover:cursor-grab`;
  };

  return (
    <div
      data-contact-id={contact.id}
      draggable={!isMoving && !hasFailed}
      onDragStart={(e) => onDragStart(e, contact)}
      onDragEnd={onDragEnd}
      onTouchStart={(e) => onTouchStart(e, contact)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => !isMoving && !hasFailed && onClick(contact)}
      className={getCardClassName()}
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}
    >
      {/* Loading/Error Overlay */}
      {(isMoving || hasFailed) && (
        <div className="absolute inset-0 bg-white bg-opacity-90 rounded-lg flex items-center justify-center z-10">
          {isMoving && (
            <div className="flex items-center text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-xs font-medium">Movendo...</span>
            </div>
          )}
          
          {hasFailed && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center text-red-600">
                <AlertTriangle className="h-4 w-4 mr-1" />
                <span className="text-xs font-medium">Falha</span>
              </div>
              <div className="flex space-x-1">
                {onRetryMove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetryMove();
                    }}
                    className="p-1 text-blue-600 hover:text-blue-800 bg-white rounded border border-blue-300 hover:bg-blue-50"
                    title="Tentar novamente"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
                {onCancelMove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelMove();
                    }}
                    className="p-1 text-red-600 hover:text-red-800 bg-white rounded border border-red-300 hover:bg-red-50"
                    title="Cancelar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card Content */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {contact.name}
          </h4>
          <p className="text-xs text-gray-500 truncate">
            {contact.email}
          </p>
          {contact.company && (
            <p className="text-xs text-gray-500 truncate">
              {contact.company}
            </p>
          )}
        </div>
        <div className="ml-2 flex space-x-1" onClick={(e) => e.stopPropagation()}>
          <ContactActions contact={contact} size="sm" />
        </div>
      </div>
      
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!selectedList && list && (
            <span
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: list.color + '20',
                color: list.color
              }}
            >
              {list.name}
            </span>
          )}
          {contact.tags.slice(0, 2).map(tagId => {
            const tag = tags.find(t => t.id === tagId);
            return tag ? (
              <span
                key={tagId}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: tag.color + '20',
                  color: tag.color
                }}
              >
                {tag.name}
              </span>
            ) : null;
          })}
        </div>
        {agent && (
          <span className="text-xs text-gray-500 truncate">
            {agent.name}
          </span>
        )}
      </div>
      
      {contact.source && (
        <div className="mt-2">
          <span className="text-xs text-gray-400">
            Fonte: {contact.source}
          </span>
        </div>
      )}
    </div>
  );
};

export default EnhancedContactCard;