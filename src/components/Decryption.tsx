import React, { useState, useRef, useEffect } from 'react';
import './Decryption.css';
import { useNotification } from '@/contexts/NotificationContext';
import QRCode from 'qrcode';
import qrcodeIcon from '@/static/qrcode.png';

interface DecryptionProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

const Decryption: React.FC<DecryptionProps> = ({ isOpen, onClose, title, content }) => {
  if (!isOpen) return null;

  const { showError, showSuccess } = useNotification();
  const [clickCount, setClickCount] = useState(0);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQrCode, setShowQrCode] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCopyDisabled, setIsCopyDisabled] = useState(false);

  // 生成二维码
  useEffect(() => {
    const generateQRCode = async () => {
      if (content.length > 320) return;
      try {
        const dataUrl = await QRCode.toDataURL(content, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrCodeDataUrl(dataUrl);
      } catch (err: any) {
        showError(err?.message || 'Failed to generate QR code');
      }
    };

    if (content) {
      generateQRCode();
    }
  }, [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccess('The secrets has been copied');
      setIsCopyDisabled(true);
    } catch (err: any) {
      showError(err?.message || 'Failed to copy decryption');
    }
  };

  const handleCopyClick = () => {
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // 清除之前的定时器
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    if (newClickCount === 3) {
      // 连击3次，执行复制
      handleCopy();
      setClickCount(0);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        setClickCount(0);
      }, 500);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const lines = content.split('\n');
  const displayContent = lines.length > 10 ? lines.slice(0, 10).join('\n') + '\n...' : content;
  const isContentTruncated = lines.length > 10;

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
          <div className='content-container'>
            <pre className='content-text'>
              {showQrCode && qrCodeDataUrl ? '' : displayContent}
            </pre>
            {showQrCode && qrCodeDataUrl && (
              <div className='qr-code-tooltip'>
                <img src={qrCodeDataUrl} alt='QR Code' className='qr-code-image' />
                <div className='qr-code-label'>Scan QR code to get full content</div>
              </div>
            )}
            {qrCodeDataUrl && (
              <img
                style={{
                  width: 36,
                  flexShrink: 0,
                  cursor: 'pointer',
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  zIndex: 9999,
                }}
                src={qrcodeIcon}
                alt='qrcode icon'
                onMouseEnter={() => setShowQrCode(true)}
                onMouseLeave={() => setShowQrCode(false)}
              />
            )}
          </div>
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
            onClick={handleCopyClick}
            disabled={isCopyDisabled}
          >
            Triple Click to Copy {clickCount > 0 && `(${clickCount}/3)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Decryption;
