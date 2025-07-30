import React, { useEffect, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemText,
  CssBaseline,
  Box,
  Container,
  ListItemButton,
  Button
} from '@mui/material';

import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

import Login from './Login';
import Clients from './components/Clients';
import Employees from './components/Employees';
import Companies from './components/Companies';
import Bank from './components/Bank';
import Dashboard from './components/Dashboard';
import UsersPage from './components/users';
import BatchChecks from './components/checks';
import Checks from './components/viewchecks';
import OptimizedViewChecks from './components/OptimizedViewChecks';

const drawerWidth = 220;

const menuItemsAdmin = [
  'Dashboard',
  'Companies',
  'Banks',
  'Users',
  'Clients',
  'Employees',
  'Checks',
  'View Checks',
  'Settings',
];

const menuItemsUser = [
  'Dashboard',
  'Checks',
  'View Checks',
];

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedSection, setSelectedSection] = useState('Dashboard');
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  const [navigatedFromDashboard, setNavigatedFromDashboard] = useState(false);


  // filter for Checks page
  const [viewFilter, setViewFilter] = useState<{
    companyId?: string;
    weekKey?: string;
    createdBy?: string;
  }>({});

  // clear filter
  const handleClearFilter = () => {
    console.log('🧹 handleClearFilter called, resetting filter');
    setViewFilter({});
    setSelectedSection('View Checks');
  };

  useEffect(() => {
    if (selectedSection !== 'View Checks') {
      setNavigatedFromDashboard(false);
    }
  }, [selectedSection]);
   
  useEffect(() => {
    console.log('📡 setting up auth listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('👤 onAuthStateChanged', firebaseUser);
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            console.log('✅ user role fetched', data.role);
            setCurrentRole(data.role || 'user');
          } else {
            console.log('⚠️ user doc not found, default role user');
            setCurrentRole('user');
          }
        } catch (err) {
          console.error('❌ error fetching user role', err);
          setCurrentRole('user');
        }
      } else {
        console.log('🚪 user signed out');
        setCurrentRole(null);
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    console.log('🚪 handleLogout called');
    await signOut(auth);
    setUser(null);
  };

  if (!authChecked) return null;
  if (!user) {
    console.log('🛑 not logged in, showing login');
    return <Login onLogin={() => setUser(auth.currentUser)} />;
  }

  const sections = currentRole === 'admin' ? menuItemsAdmin : menuItemsUser;

  console.log('🔎 rendering App, selectedSection=', selectedSection);
  console.log('🔎 current viewFilter=', viewFilter);

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            NewChecks Payroll System
          </Typography>
          {currentRole && (
            <Typography sx={{ mr: 2 }}>
              Logged in as: {currentRole.toUpperCase()}
            </Typography>
          )}
          <Button color="inherit" onClick={handleLogout}>Logout</Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {sections.map((text) => (
              <ListItemButton
                key={text}
                selected={selectedSection === text}
                onClick={() => {
                  console.log(`🖱️ Menu click: ${text}`);
                
                  // ✅ Only clear filter if actually navigating TO 'View Checks' from somewhere else
                  if (
                    text === 'View Checks' &&
                    selectedSection !== 'View Checks' &&
                    Object.keys(viewFilter).length === 0
                  ) {
                    console.log('🧹 Clearing viewFilter because menu clicked without active filter');
                    setViewFilter({});
                  }
                  
                  setNavigatedFromDashboard(false);
                  setSelectedSection(text);
                }}
                
              >
                <ListItemText primary={text} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Container>
          {selectedSection === 'Dashboard' && (
            <Dashboard
              onGoToViewChecks={(companyId, weekKey, createdBy) => {
                console.log('➡️ Dashboard → View Checks with filter', {
                  companyId,
                  weekKey,
                  createdBy,
                });
                setViewFilter({ companyId, weekKey, createdBy });
                setNavigatedFromDashboard(true); 
                setSelectedSection('View Checks');
              }}
            />
          )}

          {selectedSection === 'Companies' && <Companies />}
          {selectedSection === 'Banks' && <Bank />}
          {selectedSection === 'Users' && <UsersPage />}
          {selectedSection === 'Clients' && <Clients />}
          {selectedSection === 'Employees' && <Employees />}
          {selectedSection === 'Checks' && <BatchChecks />}

          {selectedSection === 'View Checks' && (
            <>
              {console.log('📄 Rendering OptimizedViewChecks with filter', viewFilter)}
              <OptimizedViewChecks
                filter={viewFilter}
                onClearFilter={handleClearFilter}
              />
            </>
          )}

          {selectedSection === 'Settings' && (
            <Typography variant="h4">Settings Section (Coming Soon)</Typography>
          )}
        </Container>
      </Box>
    </Box>
  );
}

export default App;
