import React, { useState } from 'react';
import './Panel.css';
import { useNotification } from '@/contexts/NotificationContext';
import { useCtx, maskEmail } from '@/contexts/Context';
import { invoke } from '@tauri-apps/api/core';
import Confirmation from './Confirmation';
import lockIcon from '@/static/lock.png';

interface PanelProps {}

interface PanelData {
  email: string;
  question: string;
  answer: string;
  confirmAnswer: string;
}

export const maskQuestion = (question: string): string => {
  if (!question) return question;
  if (question.length <= 8) return question;
  return `${question.slice(0, 8)}...`;
};

const Panel: React.FC<PanelProps> = ({}) => {
  const { showError } = useNotification();
  const {
    email: contextEmail,
    hasEmail,
    setHasEmail,
    question: contextQuestion,
    setQuestion,
    hasQuestion,
    setHasQuestion,
  } = useCtx();

  const [panelData, setPanelData] = useState<PanelData>({
    email: contextEmail,
    question: maskQuestion(contextQuestion),
    answer: '',
    confirmAnswer: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key in keyof PanelData]?: string }>({});
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  // 定义字段顺序
  const fieldOrder: (keyof PanelData)[] = ['email', 'question', 'answer', 'confirmAnswer'];

  // 验证单个字段
  const validateField = (name: keyof PanelData, value: string): string | undefined => {
    value = value.trim();
    switch (name) {
      case 'email':
        return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
          ? undefined
          : 'Please enter a valid email address';
      case 'question':
        return value.length >= 6 ? undefined : 'Question requires at least 6 characters';
      case 'answer':
        return value.length >= 6 ? undefined : 'Answer requires at least 6 characters';
      case 'confirmAnswer':
        return value === panelData.answer ? undefined : 'Confirm answer does not match';
      default:
        return undefined;
    }
  };

  // 验证当前字段和之前的字段
  const validateFieldsUpToCurrent = (
    currentFormData: PanelData,
    currentFieldName: keyof PanelData
  ): { [key in keyof PanelData]?: string } => {
    const newErrors: { [key in keyof PanelData]?: string } = {};
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof PanelData;

    let updatePanelData = {
      ...panelData,
      [name]: value,
    };

    // 当问题字段清空时，清空答案字段
    if (name === 'question' && !value) {
      updatePanelData = {
        ...updatePanelData,
        answer: '',
        confirmAnswer: '',
      };
    }

    // 当答案字段清空时，清空确认答案字段
    if (name === 'answer' && !value) {
      updatePanelData = {
        ...updatePanelData,
        confirmAnswer: '',
      };
    }

    setPanelData(updatePanelData);

    // 只验证当前字段和之前的字段
    const progressiveErrors = validateFieldsUpToCurrent(updatePanelData, fieldName);

    // 保留后续字段的现有错误状态（如果有的话）
    const currentFieldIndex = fieldOrder.indexOf(fieldName);
    const preservedErrors: { [key in keyof PanelData]?: string } = {};

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

  const validateAllFields = (currentFormData: PanelData): { [key in keyof PanelData]?: string } => {
    const newErrors: { [key in keyof PanelData]?: string } = {};

    Object.keys(currentFormData).forEach((key) => {
      const fieldName = key as keyof PanelData;
      const error = validateField(fieldName, currentFormData[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    return newErrors;
  };

  const validatePanelData = (): boolean => {
    const newErrors = validateAllFields(panelData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    try {
      let { email, question, answer } = panelData;
      closeConfirmation();
      setIsSubmitting(true);
      email = email.trim();
      question = question.trim();
      answer = answer.trim();
      await invoke('add_email_and_question', { email, question, answer });
      setPanelData({
        email: maskEmail(email),
        question: maskQuestion(question),
        answer: '',
        confirmAnswer: '',
      });
      setHasEmail(true);
      setHasQuestion(true);
      setQuestion(question);
    } catch (error: any) {
      showError(error || 'Failed to add email and question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeConfirmation = () => {
    setIsConfirmationOpen(false);
    setIsSubmitting(false);
    setPanelData({
      email: '',
      question: '',
      answer: '',
      confirmAnswer: '',
    });
  };

  const openConfirmation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validatePanelData()) {
      return;
    }
    setIsConfirmationOpen(true);
    setIsSubmitting(true);
  };

  return (
    <>
      <div className={`panel-container ${isSubmitting ? 'submitting' : ''}`}>
        <form className='panel' onSubmit={openConfirmation} autoComplete='off'>
          <div className='panel-group'>
            <label htmlFor='email'>
              GPG Email<span className='required'>*</span> :
            </label>
            {!hasEmail && (
              <div className='input-wrapper'>
                {!hasEmail && (
                  <input
                    type='text'
                    id='email'
                    name='email'
                    value={panelData.email}
                    onChange={handleInputChange}
                    className={`panel-input ${errors.email ? 'error' : ''}`}
                    disabled={isSubmitting}
                    autoComplete='off'
                    placeholder='The email for creating GPG key pair'
                  />
                )}
                {errors.email && <span className='error-message'>{errors.email}</span>}
              </div>
            )}
            {hasEmail && (
              <div className='icon-wrapper'>
                <span style={{ color: 'red', fontSize: 12 }}>{panelData.email}</span>
              </div>
            )}
          </div>
          <div className='panel-group'>
            <label htmlFor='question'>
              Secret Question<span className='required'>*</span> :
            </label>
            {!hasQuestion && (
              <div className='input-wrapper'>
                <input
                  type='text'
                  id='question'
                  name='question'
                  value={panelData.question}
                  onChange={handleInputChange}
                  className={`panel-input ${errors.question ? 'error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete='off'
                  placeholder='e.g., how do you call your dog?'
                />
                {errors.question && <span className='error-message'>{errors.question}</span>}
              </div>
            )}
            {hasQuestion && (
              <div className='icon-wrapper'>
                <span style={{ color: 'red', fontSize: 12 }}>{panelData.question}</span>
              </div>
            )}
          </div>
          <div className='panel-group'>
            <label htmlFor='answer'>
              Answer<span className='required'>*</span> :
            </label>
            {!hasQuestion && (
              <div className='input-wrapper'>
                <input
                  type='password'
                  id='answer'
                  name='answer'
                  value={panelData.answer}
                  onChange={handleInputChange}
                  className={`panel-input ${errors.answer ? 'error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete='off'
                  placeholder='Your answer to the secret question'
                />
                {errors.answer && <span className='error-message'>{errors.answer}</span>}
              </div>
            )}
            {hasQuestion && (
              <div className='icon-wrapper'>
                <span style={{ color: 'red', fontSize: 12 }}>******</span>
                <img
                  style={{ width: 16, flexShrink: 0, marginLeft: 4 }}
                  src={lockIcon}
                  alt='lock icon'
                />
              </div>
            )}
          </div>
          {!hasQuestion && (
            <div className='panel-group'>
              <label htmlFor='confirmAnswer'>
                Confirm Answer<span className='required'>*</span> :
              </label>
              <div className='input-wrapper'>
                <input
                  type='password'
                  id='confirmAnswer'
                  name='confirmAnswer'
                  value={panelData.confirmAnswer}
                  onChange={handleInputChange}
                  className={`panel-input ${errors.confirmAnswer ? 'error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete='off'
                  placeholder='Confirm answer'
                />
                {errors.confirmAnswer && (
                  <span className='error-message'>{errors.confirmAnswer}</span>
                )}
              </div>
            </div>
          )}
          {!hasQuestion && (
            <div className='panel-group'>
              <label htmlFor='spacer'></label>
              <div className='input-wrapper'>
                <button
                  type='submit'
                  className={'submit-button'}
                  disabled={hasErrors() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className='spinner'></span>
                      Submitting ...
                    </>
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
      <Confirmation
        isOpen={isConfirmationOpen}
        onClose={closeConfirmation}
        onConfirm={handleSubmit}
        title={'Add Email and Question'}
        content={`You <strong>can NOT</strong> change these settings. Are you sure to add email <strong>${panelData.email}</strong> and question <strong>${panelData.question}</strong> ?`}
        isHtml={true}
      />
    </>
  );
};

export default Panel;
