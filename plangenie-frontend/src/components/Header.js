
import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.css';

function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="header-container">
        <Link to="/" className="logo">
          🧞 PlanGenie
        </Link>
        <nav className="main-nav">
          <NavLink to="/about">About</NavLink>
          <NavLink to="/chat">Chat</NavLink>
          {user && <NavLink to="/profile">Profile</NavLink>}
        </nav>
        <div className="auth-buttons">
          {user ? (
            <button onClick={logout} className="header-button logout-btn">Logout</button>
          ) : (
            <>
              <Link to="/login" className="header-button login-btn">Login</Link>
              <Link to="/signup" className="header-button signup-btn">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;