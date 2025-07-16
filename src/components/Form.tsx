import React, { useState } from 'react';
import './Form.css';
import { useNotification } from '@/contexts/NotificationContext';
import { useCtx } from '@/contexts/Context';
import { invoke } from '@tauri-apps/api/core';
import Auth from './Auth';

interface FormProps {}

interface FormData {
  app: string;
  desc: string;
  format: string;
  secrets: string;
  pushToCloud: 'yes' | 'no';
  repo: string;
}

const Form: React.FC<FormProps> = ({}) => {
  const { showError, showSuccess } = useNotification();
  const { hasEmail, hasQuestion, hasRepository, setHasRepository } = useCtx();

  const { setListTrigger } = useCtx();

  const [formData, setFormData] = useState<FormData>({
    app: '',
    desc: '',
    format: '.txt',
    secrets: '',
    pushToCloud: 'no',
    repo: '',
  });

  const [isEncrypting, setIsEncrypting] = useState(false);
  const [errors, setErrors] = useState<{ [key in keyof FormData]?: string }>({});
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // 定义字段顺序
  const fieldOrder: (keyof FormData)[] = [
    'app',
    'desc',
    'format',
    'secrets',
    'pushToCloud',
    'repo',
  ];

  // 验证单个字段
  const validateField = (name: keyof FormData, value: string): string | undefined => {
    value = value.trim();
    const size = value.length;
    const validCharPattern = /^[a-zA-Z0-9-]+$/;
    switch (name) {
      case 'app':
        if (!validCharPattern.test(value)) {
          return 'App can only contain letters, numbers, and hyphens (a-z, A-Z, 0-9, -)';
        }
        return size >= 2 && size <= 12 ? undefined : 'App must be 2-12 characters';
      case 'desc':
        if (!validCharPattern.test(value)) {
          return 'Description can only contain letters, numbers, and hyphens (a-z, A-Z, 0-9, -)';
        }
        return size >= 2 && size <= 24 ? undefined : 'Description must be 2-24 characters';
      case 'secrets':
        return size >= 1 && size <= 1_000_000
          ? undefined
          : 'Secrets must be 1-1,000,000 characters';
      case 'repo':
        if (!hasRepository && formData.pushToCloud == 'yes') {
          const pattern =
            /^git@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/;
          if (!pattern.test(value)) {
            return `Please enter a valid ssh git repository URL`;
          }
        }
        return undefined;
      default:
        return undefined;
    }
  };

  // 验证当前字段和之前的字段
  const validateFieldsUpToCurrent = (
    currentFormData: FormData,
    currentFieldName: keyof FormData
  ): { [key in keyof FormData]?: string } => {
    const newErrors: { [key in keyof FormData]?: string } = {};
    const currentFieldIndex = fieldOrder.indexOf(currentFieldName);

    // 验证从第一个字段到当前字段（包含当前字段）
    for (let i = 0; i <= currentFieldIndex; i++) {
      const fieldName = fieldOrder[i];
      const error = validateField(fieldName, currentFormData[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
      }
    }

    return newErrors;
  };

  const handleInputChange = (
    e?: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    pushToCloud?: 'yes' | 'no'
  ) => {
    let fieldName: keyof FormData = 'pushToCloud';
    let updatedFormData = { ...formData };
    if (pushToCloud) {
      updatedFormData = { ...updatedFormData, pushToCloud };
      if (pushToCloud == 'no') {
        updatedFormData = {
          ...updatedFormData,
          repo: '',
        };
      }
    }

    if (e) {
      const { name, value } = e.target;
      fieldName = name as keyof FormData;
      updatedFormData = {
        ...updatedFormData,
        [name]: value,
      };
    }
    setFormData(updatedFormData);

    // 只验证当前字段和之前的字段
    const progressiveErrors = validateFieldsUpToCurrent(updatedFormData, fieldName);

    // 保留后续字段的现有错误状态（如果有的话）
    const currentFieldIndex = fieldOrder.indexOf(fieldName);
    const preservedErrors: { [key in keyof FormData]?: string } = {};

    for (let i = currentFieldIndex + 1; i < fieldOrder.length; i++) {
      const laterField = fieldOrder[i];
      if (errors[laterField]) {
        preservedErrors[laterField] = errors[laterField];
      }
    }

    setErrors({ ...progressiveErrors, ...preservedErrors });
  };

  const hasErrors = () => {
    return Object.values(errors).some((error) => error?.length > 0);
  };

  const validateAllFields = (currentFormData: FormData): { [key in keyof FormData]?: string } => {
    const newErrors: { [key in keyof FormData]?: string } = {};

    Object.keys(currentFormData).forEach((key) => {
      const fieldName = key as keyof FormData;
      const error = validateField(fieldName, currentFormData[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    return newErrors;
  };

  const validateFormData = (): boolean => {
    const newErrors = validateAllFields(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEncrypt = async (answer: string) => {
    try {
      let { app, desc, format, secrets, pushToCloud, repo } = formData;
      closeAuth();
      setIsEncrypting(true);
      app = app.trim();
      desc = desc.trim();
      secrets = secrets.trim();
      repo = repo.trim();
      if (repo) {
        await invoke('add_git_repository', { repo });
        setHasRepository(true);
      }
      await invoke('add_secrets', { app, desc, format, secrets, pushToCloud, answer });
      showSuccess('Encrypt secrets successfully');
    } catch (error: any) {
      showError(error || 'Failed to encrypt secrets');
    } finally {
      setIsEncrypting(false);
      setListTrigger((prev) => prev + 1);
    }
  };

  const formatJSON = () => {
    try {
      const parsed = JSON.parse(formData.secrets);
      const formatted = JSON.stringify(parsed, null, 2);
      setFormData((prev) => ({
        ...prev,
        secrets: formatted,
      }));
    } catch (error) {
      showError('Invalid .json format');
    }
  };

  const formatYAML = () => {
    try {
      // 简单的YAML格式化实现
      const lines = formData.secrets.split('\n');
      const formatted = lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;

          // 处理键值对
          if (trimmed.includes(':')) {
            const [key, ...valueParts] = trimmed.split(':');
            const value = valueParts.join(':').trim();
            const indent = line.length - line.trimStart().length;
            const spaces = ' '.repeat(indent);

            if (value) {
              return `${spaces}${key.trim()}: ${value}`;
            } else {
              return `${spaces}${key.trim()}:`;
            }
          }

          // 处理数组项
          if (trimmed.startsWith('-')) {
            const secrets = trimmed.substring(1).trim();
            const indent = line.length - line.trimStart().length;
            const spaces = ' '.repeat(indent);
            return `${spaces}- ${secrets}`;
          }

          return line;
        })
        .join('\n');

      setFormData((prev) => ({
        ...prev,
        secrets: formatted,
      }));
    } catch (error) {
      showError('Invalid .yaml format');
    }
  };

  const handleFormat = () => {
    if (formData.format === '.yml') {
      formatYAML();
    }
    if (formData.format === '.json') {
      formatJSON();
    }
  };

  const closeAuth = () => {
    setIsAuthOpen(false);
    setIsEncrypting(false);
    setFormData({ ...formData, app: '', desc: '', secrets: '' });
  };

  const openAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEmail || !hasQuestion) {
      showError('Please set your GPG Email and Secret Question first');
      return;
    }
    if (!validateFormData()) {
      return;
    }
    setIsAuthOpen(true);
    setIsEncrypting(true);
  };

  const verifyAuth = async (answer: string) => {
    const valid = await invoke<boolean>('verify_security_question', { answer });
    if (valid) {
      handleEncrypt(answer);
      return true;
    }
    return false;
  };

  return (
    <>
      <div className={`form-container ${isEncrypting ? 'submitting' : ''}`}>
        <form className='form' onSubmit={openAuth} autoComplete='off'>
          <div className='form-group'>
            <label htmlFor='app'>
              App<span className='required'>*</span> :
            </label>
            <div className='input-wrapper'>
              <input
                type='text'
                id='app'
                name='app'
                value={formData.app}
                onChange={handleInputChange}
                className={`form-input ${errors.app ? 'error' : ''}`}
                disabled={isEncrypting}
                autoComplete='off'
                placeholder='e.g., google, github, metamask'
              />
              {errors.app && <span className='error-message'>{errors.app}</span>}
            </div>
          </div>

          <div className='form-group'>
            <label htmlFor='desc'>
              Description<span className='required'>*</span> :
            </label>
            <div className='input-wrapper'>
              <input
                type='text'
                id='desc'
                name='desc'
                value={formData.desc}
                onChange={handleInputChange}
                className={`form-input ${errors.desc ? 'error' : ''}`}
                disabled={isEncrypting}
                autoComplete='off'
                placeholder='e.g., passwards, mnemonic words'
              />
              {errors.desc && <span className='error-message'>{errors.desc}</span>}
            </div>
          </div>

          <div className='form-group'>
            <label htmlFor='format'>
              Format<span className='required'>*</span> :
            </label>
            <div className='input-wrapper'>
              <select
                id='format'
                name='format'
                value={formData.format}
                onChange={handleInputChange}
                className={`format-select ${errors.format ? 'error' : ''}`}
                disabled={isEncrypting}
                style={{ fontSize: 13 }}
              >
                <option value='.txt'>.txt</option>
                <option value='.yml'>.yml</option>
                <option value='.json'>.json</option>
                <option value='.csv'>.csv</option>
              </select>
              {errors.format && <span className='error-message'>{errors.format}</span>}
            </div>
          </div>

          <div className='form-group'>
            <label htmlFor='secrets'>
              Secrets<span className='required'>*</span> :
            </label>
            <div className='input-wrapper'>
              <div className='secrets-container'>
                {['.yml', '.json'].includes(formData.format) ? (
                  <button
                    type='button'
                    className='format-button'
                    onClick={handleFormat}
                    disabled={isEncrypting}
                  >
                    Format
                  </button>
                ) : null}
                <textarea
                  id='secrets'
                  name='secrets'
                  value={formData.secrets}
                  onChange={handleInputChange}
                  className={`secrets-textarea ${errors.secrets ? 'error' : ''}`}
                  rows={12}
                  disabled={isEncrypting}
                  autoComplete='off'
                  placeholder='The secrets that will be encrypted'
                />
                {errors.secrets && <span className='error-message'>{errors.secrets}</span>}
              </div>
            </div>
          </div>

          <div className='form-group'>
            <label htmlFor='pushToCloud'>
              Push to cloud?<span className='required'>*</span> :
            </label>
            <div className='input-wrapper'>
              <div className='radio-group'>
                <div
                  className={`radio-option ${formData.pushToCloud === 'no' ? 'selected' : ''}`}
                  onClick={() => handleInputChange(undefined, 'no')}
                >
                  <div className='radio-circle'></div>
                  <span>No</span>
                </div>
                <div
                  className={`radio-option ${formData.pushToCloud === 'yes' ? 'selected' : ''}`}
                  onClick={() => handleInputChange(undefined, 'yes')}
                >
                  <div className='radio-circle'></div>
                  <span>Yes</span>
                </div>
              </div>
            </div>
          </div>

          {formData.pushToCloud == 'yes' && !hasRepository && (
            <div className='form-group'>
              <label
                htmlFor='repo'
                style={{ cursor: 'help' }}
                title='Make sure your SSH key is added to the repository'
              >
                Repository<span className='required'>*</span> :
              </label>
              <div className='input-wrapper'>
                <input
                  type='text'
                  id='repo'
                  name='repo'
                  value={formData.repo}
                  onChange={handleInputChange}
                  className={`form-input ${errors.repo ? 'error' : ''}`}
                  disabled={isEncrypting}
                  autoComplete='off'
                  placeholder='e.g., git@domain.com:user/repo.git'
                />
                {errors.repo && <span className='error-message'>{errors.repo}</span>}
              </div>
            </div>
          )}

          <div className='form-group'>
            <label htmlFor='spacer'></label>
            <div className='input-wrapper'>
              <button
                type='submit'
                className={'encrypt-button'}
                disabled={hasErrors() || isEncrypting}
              >
                {isEncrypting ? (
                  <>
                    <span className='spinner'></span>
                    Encrypting ...
                  </>
                ) : (
                  'Encrypt'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
      <Auth isOpen={isAuthOpen} onClose={closeAuth} onVerify={verifyAuth} />
    </>
  );
};

export default Form;
