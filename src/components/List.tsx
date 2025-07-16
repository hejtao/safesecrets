import React, { useState, useEffect } from 'react';
import './List.css';
import { useNotification } from '@/contexts/NotificationContext';
import { invoke } from '@tauri-apps/api/core';
import Decryption from './Decryption';
import { useCtx } from '@/contexts/Context';
import Auth from './Auth';
import Confirmation from './Confirmation';
import searchIcon from '@/static/search.png';

interface ListProps {}

interface ListItem {
  id: string;
  app: string;
  desc: string;
  format: string;
}

const List: React.FC<ListProps> = ({}) => {
  const { showError, showSuccess } = useNotification();
  const { hasEmail, hasQuestion, listTrigger } = useCtx();

  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const [isDecryptionOpen, setIsDecryptionOpen] = useState(false);
  const [decryptionContent, setDecryptionContent] = useState('');
  const [decryptionTitle, setDecryptionTitle] = useState('');

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const [id, setId] = useState('');
  const [action, setAction] = useState('');

  const [searchStr, setSearchStr] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadListItems();
  }, []);

  useEffect(() => {
    if (listTrigger > 0) {
      loadListItems();
    }
  }, [listTrigger]);

  const handleDelete = async (id: string) => {
    try {
      closeConfirmation();
      setIsDeleting(true);
      await invoke('delete_secrets', { id });
      setListItems(listItems.filter((item) => item.id !== id));
      showSuccess(`Delete secrets ${id} successfully`);
    } catch (error: any) {
      showError(error || 'Failed to delete secrets');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDecrypt = async (id: string, answer?: string) => {
    try {
      setIsDecrypting(true);
      const msg = await invoke<string>('decrypt_secrets', { id, answer });
      setDecryptionTitle(`Decrypt Secrets ${id}`);
      setDecryptionContent(msg);
      setIsDecryptionOpen(true);
    } catch (error: any) {
      showError(error || 'Failed to decrypt secrets');
    } finally {
      setIsDecrypting(false);
    }
  };

  const loadListItems = async (searchStr = '') => {
    try {
      setIsLoading(true);
      const data = await invoke<ListItem[]>('get_secrets_list', { searchStr });
      setListItems(data);
    } catch (error: any) {
      if (searchStr) showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const closeDecryption = () => {
    setIsDecryptionOpen(false);
    setDecryptionContent('');
    setDecryptionTitle('');
  };

  const closeAuth = () => {
    setIsAuthOpen(false);
    if (action === 'decrypt') setIsDecrypting(false);
    if (action === 'delete') setIsDeleting(false);
    setId('');
    setAction('');
  };

  const openAuth = (id: string, action: string) => {
    if (!hasEmail || !hasQuestion) {
      showError('Please set your GPG Email and Secret Question first');
      return;
    }
    setIsAuthOpen(true);
    if (action === 'decrypt') setIsDecrypting(true);
    if (action === 'delete') setIsDeleting(true);
    setId(id);
    setAction(action);
  };

  const verifyAuth = async (answer: string) => {
    const valid = await invoke<boolean>('verify_security_question', { answer });
    if (valid) {
      if (action === 'decrypt') handleDecrypt(id, answer);
      if (action === 'delete') handleDelete(id);
      return true;
    }
    return false;
  };

  const closeConfirmation = () => {
    setIsConfirmationOpen(false);
    setIsDeleting(false);
  };

  const openConfirmation = (id: string) => {
    setIsConfirmationOpen(true);
    setIsDeleting(true);
    setId(id);
  };

  const handleSearch = async () => {
    if (!hasEmail || !hasQuestion) {
      showError('Please set your GPG Email and Secret Question first');
      return;
    }
    setIsSearching(true);
    await loadListItems(searchStr);
    showSuccess('Search secrets successfully');
    setSearchStr('');
    setIsSearching(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <>
      <div className={`list-container ${isLoading ? 'loading' : ''}`}>
        <div className={'list-header'}>
          <div className={`input-wrapper-img`}>
            <input
              type='text'
              autoComplete='on'
              value={searchStr}
              onChange={(e) => setSearchStr(e.target.value)}
              placeholder='Search'
            />
            {isSearching ? (
              <div className='spinner'></div>
            ) : (
              <img
                title='Search'
                src={searchIcon}
                alt='search icon'
                onClick={handleSearch}
                onKeyDown={handleKeyPress}
                style={{ width: 20, flexShrink: 0, marginRight: 5, cursor: 'pointer' }}
              />
            )}
          </div>

          {/* <button
            type='button'
            className='search-button'
            onClick={() => loadListItems(true)}
            disabled={isLoading}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button> */}
        </div>
        <div
          className={'list-item'}
          style={{
            fontWeight: '600',
            boxShadow: 'none',
            backgroundColor: '#fff',
            borderColor: '#e5e5e5',
          }}
        >
          <div className={'list-item-field'} style={{ flex: 5 }}>
            No.
          </div>
          <div className={'list-item-field'} style={{ flex: 10 }}>
            App
          </div>
          <div className={'list-item-field'} style={{ flex: 10 }}>
            Desc
          </div>
          <div className={'list-item-field'} style={{ flex: 10 }}>
            Format
          </div>
          <div style={{ textAlign: 'right', flex: 20 }}></div>
        </div>

        {isLoading ? (
          <div className={'list-loading'}>
            <span className={'loading-spinner'}></span>
            <span></span>
          </div>
        ) : listItems.length > 0 ? (
          listItems.map((item, index) => (
            <div key={item.id} className={'list-item'}>
              <div className={'list-item-field'} style={{ flex: 5 }}>
                {item.id}
              </div>
              <div className={'list-item-field'} style={{ flex: 10 }}>
                {item.app}
              </div>
              <div className={'list-item-field'} style={{ flex: 10 }}>
                {item.desc}
              </div>
              <div className={'list-item-field list-item-format'} style={{ flex: 10 }}>
                {item.format}
              </div>
              <div style={{ textAlign: 'right', flex: 20, display: 'flex', gap: 6 }}>
                <button
                  type='button'
                  className='decrypt-button'
                  onClick={
                    hasQuestion ? () => openAuth(item.id, 'decrypt') : () => handleDecrypt(item.id)
                  }
                  disabled={isDecrypting || isDeleting}
                >
                  {isDecrypting && item.id == id ? 'Decrypting...' : 'Decrypt'}
                </button>
                <button
                  type='button'
                  className='delete-button'
                  onClick={
                    hasQuestion
                      ? () => openAuth(item.id, 'delete')
                      : () => openConfirmation(item.id)
                  }
                  disabled={isDeleting || isDecrypting}
                >
                  {isDeleting && item.id == id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className={'list-empty'}>No secrets</div>
        )}
      </div>

      <Decryption
        isOpen={isDecryptionOpen}
        onClose={closeDecryption}
        title={decryptionTitle}
        content={decryptionContent}
      />

      <Auth isOpen={isAuthOpen} onClose={closeAuth} onVerify={verifyAuth} />

      <Confirmation
        isOpen={isConfirmationOpen}
        onClose={closeConfirmation}
        onConfirm={() => handleDelete(id)}
        title={'Delete Secrets'}
        content={`Are you sure to delete the secrets <strong>${id}</strong> ?`}
        isHtml={true}
      />
    </>
  );
};

export default List;
