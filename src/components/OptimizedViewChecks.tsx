import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Box,
  Typography,
  Button,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  CircularProgress,
  TextField,
  Chip
} from '@mui/material';
import { useOptimizedData } from '../hooks/useOptimizedData';
import { auth } from '../firebase';
import { useLocation } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { saveAs } from 'file-saver';

interface Company {
  id: string;
  name: string;
}

interface CheckItem {
  id: string;
  companyId: string;
  employeeName: string;
  amount: number;
  memo?: string;
  date: any;
  createdBy?: string;
  hours?: number;
  otHours?: number;
  holidayHours?: number;
  payRate?: number;
  payType?: string;
  checkNumber?: number;
  reviewed?: boolean;
}

interface UserMap {
  [uid: string]: string;
}

interface ChecksProps {
  filter?: {
    companyId?: string;
    weekKey?: string;
    createdBy?: string;
  };
  onClearFilter?: () => void;
}

const OptimizedViewChecks: React.FC<ChecksProps> = ({ filter, onClearFilter }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [selectedCreatedBy, setSelectedCreatedBy] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckItem | null>(null);

  const location = useLocation();

  // Debounce search text to reduce re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Parse filters from URL if present
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlCompany = params.get('companyId');
    const urlWeek = params.get('weekKey');
    const urlCreatedBy = params.get('createdBy');
    if (urlCompany) setSelectedCompanyId(urlCompany);
    if (urlWeek) setSelectedWeekKey(urlWeek);
    if (urlCreatedBy) setSelectedCreatedBy(urlCreatedBy);
  }, [location.search]);

  // Fetch current user role
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user role - you might want to optimize this too
        // setCurrentRole('admin'); // Simplified for now
      }
    });
    return () => unsubscribe();
  }, []);

  // Optimized data fetching with staggered loading
  const { data: companies, loading: companiesLoading } = useOptimizedData<Company>('companies', {}, {
    cacheTime: 10 * 60 * 1000, // 10 minutes
    staleTime: 60 * 1000, // 1 minute
    backgroundUpdate: false // Disable real-time for companies to reduce listeners
  });

  const { data: users } = useOptimizedData<any>('users', {}, {
    cacheTime: 10 * 60 * 1000,
    staleTime: 60 * 1000,
    backgroundUpdate: false // Disable real-time for users to reduce listeners
  });

  const { data: checks, loading: checksLoading, refetch: refetchChecks } = useOptimizedData<CheckItem>('checks', 
    selectedCompanyId ? { companyId: selectedCompanyId } : {},
    {
      cacheTime: 2 * 60 * 1000, // 2 minutes
      staleTime: 30 * 1000, // 30 seconds
      backgroundUpdate: selectedCompanyId ? true : false // Only enable real-time when company is selected
    }
  );

  // Memoized user map
  const userMap = useMemo(() => {
    const map: UserMap = {};
    users.forEach((user: any) => {
      map[user.id] = user.username || user.email || 'Unknown';
    });
    return map;
  }, [users]);

  // Memoized filtered checks
  const filteredChecks = useMemo(() => {
    if (!selectedCompanyId || checksLoading) return [];
    
    let filtered = checks.filter(c => c.companyId === selectedCompanyId);
    
    // Apply week filter
    if (selectedWeekKey) {
      filtered = filtered.filter((c: any) => {
        const dateObj = c.date?.toDate ? c.date.toDate() : new Date(c.date);
        // Inline week key calculation
        const d = new Date(dateObj);
        const weekKey = new Date(d.setDate(d.getDate() - d.getDay())).toISOString().slice(0, 10);
        return weekKey === selectedWeekKey;
      });
    }
    
    // Apply createdBy filter
    if (selectedCreatedBy) {
      filtered = filtered.filter((c: any) => c.createdBy === selectedCreatedBy);
    }
    
    // Apply search filter
    if (debouncedSearchText) {
      filtered = filtered.filter((c: any) => {
        const nameMatch = c.employeeName?.toLowerCase().includes(debouncedSearchText.toLowerCase());
        const madeByMatch = c.createdBy && userMap[c.createdBy]?.toLowerCase().includes(debouncedSearchText.toLowerCase());
        return nameMatch || madeByMatch;
      });
    }
    
    return filtered.sort((a, b) => (b.checkNumber || 0) - (a.checkNumber || 0));
  }, [selectedCompanyId, checks, selectedWeekKey, selectedCreatedBy, debouncedSearchText, userMap, checksLoading]);

  // Memoized checks by week
  const checksByWeek = useMemo(() => {
    const grouped: { [week: string]: CheckItem[] } = {};
    filteredChecks.forEach(c => {
      const dateObj = c.date?.toDate ? c.date.toDate() : new Date(c.date);
      // Inline week key calculation
      const d = new Date(dateObj);
      const key = new Date(d.setDate(d.getDate() - d.getDay())).toISOString().slice(0, 10);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });
    return grouped;
  }, [filteredChecks]);

  // Get sorted week keys for the selected company
  const weekKeys = useMemo(() => {
    if (!selectedCompanyId) return [];
    return Object.keys(checksByWeek).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [selectedCompanyId, checksByWeek]);

  // Helper to print all checks for a week
  const handlePrintWeek = async (companyId: string, weekKey: string) => {
    try {
      const response = await fetch(
        `http://localhost:5004/api/print_week?companyId=${companyId}&weekKey=${weekKey}`
      );
      if (!response.ok) {
        alert('Error fetching PDF.');
        return;
      }
      const blob = await response.blob();
      saveAs(blob, `checks_${weekKey}.pdf`);
    } catch (err) {
      alert('Error printing checks.');
    }
  };

  // Optimized handlers
  const handleCompanySelect = useCallback((companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedWeekKey(null);
    setSelectedCreatedBy(null);
  }, []);

  const handleBackToCompanies = useCallback(() => {
    setSelectedCompanyId(null);
    setSelectedWeekKey(null);
    setSelectedCreatedBy(null);
    if (onClearFilter) onClearFilter();
  }, [onClearFilter]);

  const handleOpenDialog = useCallback((check: CheckItem) => {
    setSelectedCheck(check);
    setOpenDialog(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedCheck(null);
  }, []);

  // Loading states
  if (companiesLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Checks</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={60} />
          ))}
        </Box>
      </Box>
    );
  }

  // Show loading for initial data fetch
  if (!companies.length && !companiesLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Checks</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Checks</Typography>

      {!selectedCompanyId ? (
        <>
          <Typography variant="h6">Select a Company:</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
            {companies.map(c => (
              <Button
                key={c.id}
                variant="contained"
                onClick={() => handleCompanySelect(c.id)}
                sx={{ maxWidth: 300, textAlign: 'left' }}
              >
                {c.name}
              </Button>
            ))}
          </Box>
        </>
      ) : (
        <>
          <Button
            variant="outlined"
            sx={{ mb: 3 }}
            onClick={() => {
              setSelectedCompanyId(null);
              setSelectedWeekKey(null);
              setSelectedCreatedBy(null);
              if (onClearFilter) onClearFilter();
            }}
          >
            ← Back to Companies
          </Button>

          {/* Week selection menu */}
          {!selectedWeekKey ? (
            <>
              <Typography variant="h6" sx={{ mb: 2 }}>Select a Work Week:</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                {weekKeys.map(weekKey => (
                  <Button
                    key={weekKey}
                    variant="contained"
                    onClick={() => setSelectedWeekKey(weekKey)}
                    sx={{ maxWidth: 300, textAlign: 'left' }}
                  >
                    Week starting: {weekKey}
                  </Button>
                ))}
              </Box>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                sx={{ mb: 2 }}
                onClick={() => setSelectedWeekKey(null)}
              >
                ← Back to Weeks
              </Button>
              <Typography variant="h6" gutterBottom>
                Checks for {companies.find(c => c.id === selectedCompanyId)?.name} - Week starting: {selectedWeekKey}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                sx={{ mb: 2 }}
                onClick={() => handlePrintWeek(selectedCompanyId, selectedWeekKey)}
              >
                📄 Print All Checks
              </Button>
              <Divider sx={{ my: 1 }} />
              {checksByWeek[selectedWeekKey]?.length ? (
                checksByWeek[selectedWeekKey].map(check => {
                  const d = check.date?.toDate ? check.date.toDate() : new Date(check.date);
                  const madeByName = check.createdBy ? userMap[check.createdBy] || 'Unknown' : 'Unknown';
                  return (
                    <Box
                      key={check.id}
                      sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid #ddd',
                        borderRadius: 1,
                        p: 1,
                        mb: 1
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography><strong>Check #:</strong> {check.checkNumber ?? 'N/A'}</Typography>
                        <Typography><strong>Employee:</strong> {check.employeeName}</Typography>
                        <Typography><strong>Amount:</strong> ${check.amount.toFixed(2)}</Typography>
                        {check.reviewed ? (
                          <Chip label="✅ Reviewed" color="success" size="small" />
                        ) : (
                          <Chip label="⏳ Pending" color="warning" size="small" />
                        )}
                        {check.memo && (
                          <Typography><strong>Memo:</strong> {check.memo}</Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          Date: {d.toLocaleDateString()}
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          sx={{ mt: 1 }}
                          onClick={() => handleOpenDialog(check)}
                        >
                          🔎 Details
                        </Button>
                      </Box>
                      <Box sx={{ textAlign: 'right', minWidth: 120 }}>
                        <Typography variant="body2" color="text.secondary">
                          Made by: {madeByName}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              ) : (
                <Typography>No checks found for this week.</Typography>
              )}
            </>
          )}
        </>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Check Details</DialogTitle>
        <DialogContent dividers>
          {selectedCheck ? (
            <>
              <Typography><strong>Employee:</strong> {selectedCheck.employeeName}</Typography>
              <Typography><strong>Company:</strong> {companies.find(c => c.id === selectedCheck.companyId)?.name}</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography><strong>Regular Hours:</strong> {selectedCheck.hours || 0}</Typography>
              <Typography><strong>OT Hours:</strong> {selectedCheck.otHours || 0}</Typography>
              <Typography><strong>Holiday Hours:</strong> {selectedCheck.holidayHours || 0}</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography><strong>Base Rate:</strong> ${selectedCheck.payRate?.toFixed(2) || '0.00'}</Typography>
              <Typography><strong>Calculated Amount:</strong> ${selectedCheck.amount?.toFixed(2)}</Typography>
              {selectedCheck.memo && (
                <Typography><strong>Memo:</strong> {selectedCheck.memo}</Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                Date: {selectedCheck.date?.toDate ? selectedCheck.date.toDate().toLocaleString() : new Date(selectedCheck.date).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Made by: {selectedCheck.createdBy ? userMap[selectedCheck.createdBy] || 'Unknown' : 'Unknown'}
              </Typography>
            </>
          ) : (
            <Typography>No check selected.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {selectedCheck && !selectedCheck.reviewed && (
            <Button
              color="success"
              variant="contained"
              onClick={async () => {
                await updateDoc(doc(db, 'checks', selectedCheck.id), { reviewed: true });
                refetchChecks();
                handleCloseDialog();
              }}
            >
              ✅ Mark as Reviewed
            </Button>
          )}
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OptimizedViewChecks; 