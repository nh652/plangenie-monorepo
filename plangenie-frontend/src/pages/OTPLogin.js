
import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link,
  CircularProgress,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OTPLogin = () => {
  const [step, setStep] = useState(0);
  const [phoneEmail, setPhoneEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { requestOTP, verifyOTP } = useAuth();

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await requestOTP(phoneEmail);
      setSuccess('OTP sent successfully! Check your console/logs for the OTP code.');
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verifyOTP(phoneEmail, otp);
      setSuccess('OTP verified successfully!');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box textAlign="center" mb={3}>
          <Typography variant="h4" component="h1" color="primary" gutterBottom>
            📱 PlanGenie
          </Typography>
          <Typography variant="h6" color="textSecondary">
            Login with OTP
          </Typography>
        </Box>

        <Stepper activeStep={step} sx={{ mb: 3 }}>
          <Step>
            <StepLabel>Enter Phone/Email</StepLabel>
          </Step>
          <Step>
            <StepLabel>Verify OTP</StepLabel>
          </Step>
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {step === 0 ? (
          <form onSubmit={handleRequestOTP}>
            <TextField
              fullWidth
              label="Phone or Email"
              value={phoneEmail}
              onChange={(e) => setPhoneEmail(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              helperText="Enter your phone number or email to receive OTP"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Send OTP'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <TextField
              fullWidth
              label="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              helperText="Check your console/logs for the OTP code"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify OTP'}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setStep(0)}
              disabled={loading}
            >
              Back
            </Button>
          </form>
        )}

        <Box textAlign="center" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <Link component="button" onClick={() => navigate('/login')}>
              Login with password
            </Link>
            {' | '}
            <Link component="button" onClick={() => navigate('/signup')}>
              Create account
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default OTPLogin;
