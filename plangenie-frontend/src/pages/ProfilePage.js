import React from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfilePage.css';

function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h2>Your Profile</h2>
        {user ? (
          <div className="profile-details">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>User ID:</strong> {user.uid}</p>
            <button onClick={logout} className="profile-logout-button">
              Log Out
            </button>
          </div>
        ) : (
          <p>Loading user data...</p>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;