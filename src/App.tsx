import '@/App.css';
import { NotificationProvider, useNotification } from '@/contexts/NotificationContext';
import NotificationManager from '@/components/NotificationManager';
import Form from '@/components/Form';
import List from '@/components/List';
import Panel from '@/components/Panel';
import { ContextProvider, useCtx } from '@/contexts/Context';
import Confirmation from './components/Confirmation';
import { invoke } from '@tauri-apps/api/core';

function AppContent() {
  const { isInitializing, isGitAvailable, isGpgAvailable } = useCtx();
  if (isInitializing) {
    return (
      <div className='app'>
        <div className='boot'>Initializing...</div>
      </div>
    );
  }

  const { notifications, removeNotification, showError } = useNotification();

  const isConfirmationOpen = !isGitAvailable || !isGpgAvailable;

  const exitApp = async () => {
    try {
      await invoke('exit_app');
    } catch (err: any) {
      showError(err);
    }
  };

  return (
    <div className='app'>
      <main className='main-content'>
        <NotificationManager notifications={notifications} onRemove={removeNotification} />
        <Confirmation
          isOpen={isConfirmationOpen}
          onConfirm={exitApp}
          title={'Exit Safesecrets'}
          content={`
            <p>Welcome to Safesecrets!</p>
            <p>Before using Safesecrets, please ensure:</p>
            <ul>
            ${
              !isGitAvailable
                ? `<li>Git is not installed. Please <strong>install Git</strong> first.</li>`
                : ''
            }
            ${
              !isGpgAvailable
                ? `<li>GPG is not installed. Please <strong>install GPG</strong> first.</li>`
                : ''
            }
            </ul>
            <p>${
              !isGitAvailable && !isGpgAvailable ? 'Those are' : 'That is'
            } required for Safesecrets to function properly.</p>
            `}
          isHtml={true}
        />
        <div className='side-content'>
          <Form />
        </div>
        <div className='side-content'>
          <Panel />
          <List />
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ContextProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ContextProvider>
  );
}

export default App;
