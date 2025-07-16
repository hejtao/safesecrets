import React from 'react';
import Notification from './Notification';
import './NotificationManager.css';

export interface NotificationItem {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

interface NotificationManagerProps {
  notifications: NotificationItem[];
  onRemove: (id: string) => void;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ notifications, onRemove }) => {
  return (
    <div className='notification-manager'>
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            position: 'fixed',
            top: `${20 + index * 70}px`,
            right: `${20}px`,
            zIndex: 9999 - index /* 确保每个通知都在最上层，但保持堆叠顺序 */,
            transform: `translateX(${index * 3}px)` /* 添加轻微的水平错位效果 */,
          }}
        >
          <Notification
            message={notification.message}
            type={notification.type}
            duration={notification.duration}
            onClose={() => onRemove(notification.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationManager;
