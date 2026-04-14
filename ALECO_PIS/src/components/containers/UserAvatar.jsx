import React, { useState } from 'react';

const userInitial = (user) => {
  const s = (user.name || user.email || '?').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
};

/**
 * Shows Google-synced profile_pic from DB (same source as OAuth login sync in auth.js).
 */
const UserAvatar = ({ user, imgClassName = '', fallbackClassName = '' }) => {
  const [failed, setFailed] = useState(false);
  const raw = user.profile_pic ?? user.profilePic;
  const url = raw && String(raw).trim();

  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        className={imgClassName}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={fallbackClassName} aria-hidden="true">
      {userInitial(user)}
    </div>
  );
};

export default UserAvatar;
export { userInitial };
