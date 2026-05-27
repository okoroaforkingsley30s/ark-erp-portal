import { useState } from 'react';

export default function useDMNotifications(user) {
  const [dmUnreadCount, setDmUnreadCount] = useState(0);

  const resetDMCount = () => {
    setDmUnreadCount(0);
  };

  return {
    dmUnreadCount,
    resetDMCount,
  };
}