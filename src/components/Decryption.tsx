import React from 'react';
import './Decryption.css';
import { useNotification } from '@/contexts/NotificationContext';

interface DecryptionProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

const Decryption: React.FC<DecryptionProps> = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  const { showError, showSuccess } = useNotification();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccess('The secrets has been copied');
    } catch (err: any) {
      showError(err?.message || 'Failed to copy decryption');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const lines = content.split('\n');
  const displayContent = lines.length > 5 ? lines.slice(0, 5).join('\n') + '\n...' : content;
  const isContentTruncated = lines.length > 5;

  return (
    <div className='decryption-overlay' onClick={handleOverlayClick}>
      <div className='decryption'>
        <div className='decryption-header'>
          <h3 className='decryption-title'>{title}</h3>
          <button className='decryption-close' onClick={onClose}>
            ×
          </button>
        </div>
        <div className='decryption-body'>
          <pre className='content-text'>{displayContent}</pre>
          {isContentTruncated && (
            <div className='content-truncated-hint'>
              Content truncated, full content can be obtained via copy button.
            </div>
          )}
        </div>
        <div className='decryption-footer'>
          <button
            type='button'
            className='decryption-button decryption-button-cancel'
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type='button'
            className='decryption-button decryption-button-copy'
            onClick={handleCopy}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
};

export default Decryption;
