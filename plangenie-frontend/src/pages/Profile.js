
import React from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate('/')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            My Account
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box textAlign="center" mb={4}>
            <Typography variant="h4" color="primary" gutterBottom>
              📱 PlanGenie
            </Typography>
            <Typography variant="h6" color="textSecondary">
              Account Details
            </Typography>
          </Box>

          <Box mb={3}>
            <Typography variant="body1" color="textSecondary">
              Email
            </Typography>
            <Typography variant="h6">
              {user?.email}
            </Typography>
          </Box>

          <Box mb={3}>
            <Typography variant="body1" color="textSecondary">
              Account Status
            </Typography>
            <Typography variant="h6" color="success.main">
              Active
            </Typography>
          </Box>

          <Button
            fullWidth
            variant="outlined"
            color="error"
            onClick={handleLogout}
            sx={{ mt: 2 }}
          >
            Logout
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default Profile;
