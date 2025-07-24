import React from 'react';
import './Footer.css';

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <p>&copy; {new Date().getFullYear()} PlanGenie. All Rights Reserved.</p>
        <div className="footer-links">
          <a href="/about">About</a>
          <span>|</span>
          <a href="https://github.com/nh652/TelcoPlans" target="_blank" rel="noopener noreferrer">Source Code</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;