import React from 'react';
import './Confirmation.css';

interface ConfirmationProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfirm: () => void;
  title: string;
  content: string;
  isHtml?: boolean;
}

const Confirmation: React.FC<ConfirmationProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  content,
  isHtml = false,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <div className='confirmation-overlay' onClick={handleOverlayClick}>
      <div className='confirmation'>
        <div className='confirmation-header'>
          <h3 className='confirmation-title'>{title}</h3>
          {onClose && (
            <button className='confirmation-close' onClick={onClose}>
              ×
            </button>
          )}
        </div>
        <div className='confirmation-body'>
          {isHtml ? (
            <div className='content-text' dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <pre className='content-text'>{content}</pre>
          )}
        </div>
        <div className='confirmation-footer'>
          {onClose && (
            <button
              type='button'
              className='confirmation-button confirmation-button-cancel'
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          <button
            type='button'
            className='confirmation-button confirmation-button-confirm'
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default Confirmation;
