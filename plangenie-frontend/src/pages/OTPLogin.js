import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css'; // Shared styles

function OTPLogin() {
  const [step, setStep] = useState('request'); // 'request' or 'verify'
  const [destination, setDestination] = useState(''); // Email or Phone
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { requestOTP, verifyOTP } = useAuth();
  const navigate = useNavigate();

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    const result = await requestOTP(destination);
    if (result.success) {
      setStep('verify');
      setMessage(`An OTP has been sent to ${destination}.`);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await verifyOTP(destination, code);
    if (result.success) {
      navigate('/chat');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      {step === 'request' ? (
        <>
          <h2>Login with OTP</h2>
          <p>Enter your email to receive a one-time password.</p>
          {error && <div className="error-message">{error}</div>}
          <form className="auth-form" onSubmit={handleRequest}>
            <div className="input-group">
              <label htmlFor="destination">Email</label>
              <input
                type="email"
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <button className="auth-button" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        </>
      ) : (
        <>
          <h2>Verify OTP</h2>
          <p>{message}</p>
          {error && <div className="error-message">{error}</div>}
          <form className="auth-form" onSubmit={handleVerify}>
            <div className="input-group">
              <label htmlFor="code">One-Time Password</label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
              />
            </div>
            <button className="auth-button" type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
          </form>
        </>
      )}
      <div className="auth-link">
        <Link to="/login">Back to password login</Link>
      </div>
    </div>
  );
}
export default OTPLogin;
