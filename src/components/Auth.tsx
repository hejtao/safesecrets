import React, { useState, useEffect, useRef } from 'react';
import './Auth.css';
import { useCtx } from '@/contexts/Context';

interface AuthProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<boolean>;
  title?: string;
}

const Auth: React.FC<AuthProps> = ({
  isOpen,
  onClose,
  onVerify,
  title = 'Verify Secret Question',
}) => {
  if (!isOpen) return null;

  const { question } = useCtx();
  const [answer, setAnswer] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (isOpen) {
      setAnswer('');
      setError('');
    }
  }, [isOpen]);

  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAnswer(value);
    setError(value.length >= 6 ? '' : 'Answer requires at least 6 characters');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (error) {
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const isValid = await onVerify(answer);
      if (isValid) {
        onClose();
      } else {
        setError('Invalid answer, please try again');
        setAnswer('');
      }
    } catch (error: any) {
      setError('Failed to verify, please try again');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className='auth-overlay' onClick={handleOverlayClick}>
      <div className='auth'>
        <div className='auth-header'>
          <h3 className='auth-title'>{title}</h3>
          <button className='auth-close' onClick={onClose} disabled={isVerifying}>
            ×
          </button>
        </div>

        <form className='auth-form' onSubmit={handleSubmit}>
          <div className='auth-body'>
            <div className='auth-group'>
              <label htmlFor='question'>Q:</label>
              <div className='input-wrapper'>
                <span style={{ fontSize: 13 }}>{question}</span>
              </div>
            </div>
            <div className='auth-group'>
              <label htmlFor='answer'>A:</label>
              <div className='input-wrapper'>
                <input
                  ref={inputRef}
                  type='password'
                  className={`auth-input ${error ? 'error' : ''}`}
                  value={answer}
                  onChange={handleAnswerChange}
                  onKeyDown={handleKeyPress}
                  placeholder=''
                  disabled={isVerifying}
                  autoComplete='off'
                />
                {error && <div className='error-message'>{error}</div>}
              </div>
            </div>
          </div>

          <div className='auth-footer'>
            <button
              type='button'
              className='auth-button auth-button-cancel'
              onClick={onClose}
              disabled={isVerifying}
            >
              Cancel
            </button>
            <button
              type='submit'
              className='auth-button auth-button-verify'
              disabled={isVerifying || answer.length < 2}
            >
              {isVerifying ? (
                <>
                  <div className='spinner'></div>
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth;
