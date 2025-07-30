import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, InputLabel, FormControl,
  Switch, FormControlLabel, Card, CardContent, Avatar, Chip, Stack
} from '@mui/material';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import PersonIcon from '@mui/icons-material/Person';
import WorkIcon from '@mui/icons-material/Work';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

interface Employee {
  id: string;
  name: string;
  address: string;
  position: string;
  payRate: number;
  payType: string;
  companyId?: string | null;
  companyIds?: string[];
  clientId?: string | null;
  active: boolean;
  startDate?: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
  address?: string;
  companyIds?: string[];
}

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [newEmployee, setNewEmployee] = useState({
    name: '',
    address: '',
    position: '',
    payRate: '',
    payType: 'hourly',
    companyIds: [] as string[],
    clientId: '',
    startDate: ''
  });

  const [editEmployee, setEditEmployee] = useState({
    name: '',
    address: '',
    position: '',
    payRate: '',
    payType: 'hourly',
    companyId: '',
    startDate: ''
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEmployee, setProfileEmployee] = useState<Employee | null>(null);
  const [profileEdit, setProfileEdit] = useState<any>(null);
  const [profileChecks, setProfileChecks] = useState<any[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const empSnap = await getDocs(collection(db, 'employees'));
      setEmployees(empSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Employee[]);

      const compSnap = await getDocs(collection(db, 'companies'));
      setCompanies(compSnap.docs.map((d) => ({ id: d.id, name: d.data().name })));

      const cliSnap = await getDocs(collection(db, 'clients'));
      const cliList: Client[] = cliSnap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          address: data.address,
          companyIds: data.companyId || []
        };
      });
      setClients(cliList);
    };
    fetchData();
  }, []);

  const getCompanyName = (id?: string | null): string => {
    if (!id) return 'No Company';
    const c = companies.find((co) => co.id === id);
    return c ? c.name : 'Unknown Company';
  };

  const handleAdd = async () => {
    const parsedRate = parseFloat(newEmployee.payRate);
    const data: any = {
      name: newEmployee.name,
      address: newEmployee.address,
      position: newEmployee.position,
      payRate: isNaN(parsedRate) ? 0 : parsedRate,
      payType: newEmployee.payType,
      active: true,
      clientId: newEmployee.clientId || null,
      startDate: newEmployee.startDate || null
    };

    if (!selectedCompanyId) {
      data.companyIds = newEmployee.companyIds;
    } else {
      data.companyId = selectedCompanyId;
    }

    const docRef = await addDoc(collection(db, 'employees'), data);
    setEmployees((prev) => [...prev, { id: docRef.id, ...data } as Employee]);
    setOpenAdd(false);
    setNewEmployee({
      name: '',
      address: '',
      position: '',
      payRate: '',
      payType: 'hourly',
      companyIds: [],
      clientId: '',
      startDate: ''
    });
  };

  const handleCardClick = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditEmployee({
      name: emp.name,
      address: emp.address,
      position: emp.position,
      payRate: String(emp.payRate),
      payType: emp.payType,
      companyId: emp.companyId || '',
      startDate: emp.startDate || ''
    });
    setOpenEdit(true);
  };

  const getClientName = (id?: string | null): string => {
    if (!id) return 'No Client';
    const cl = clients.find(c => c.id === id);
    return cl ? cl.name : 'Unknown Client';
  };

  const handleSaveEdit = async () => {
    if (!selectedEmployee) return;
    const parsedRate = parseFloat(editEmployee.payRate);
    const updated = {
      name: editEmployee.name,
      address: editEmployee.address,
      position: editEmployee.position,
      payRate: isNaN(parsedRate) ? 0 : parsedRate,
      payType: editEmployee.payType,
      companyId: editEmployee.companyId || null,
      startDate: editEmployee.startDate || null
    };
    await updateDoc(doc(db, 'employees', selectedEmployee.id), updated);
    setEmployees(prev => prev.map(e => (e.id === selectedEmployee.id ? { ...e, ...updated } : e)));
    setOpenEdit(false);
    setSelectedEmployee(null);
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedEmployee.name}?`);
    if (!confirmDelete) return;
    await updateDoc(doc(db, 'employees', selectedEmployee.id), {});
    await import('firebase/firestore').then(({ deleteDoc }) =>
      deleteDoc(doc(db, 'employees', selectedEmployee.id))
    );
    setEmployees(prev => prev.filter(e => e.id !== selectedEmployee.id));
    setOpenEdit(false);
    setSelectedEmployee(null);
  };

  const handleToggleActive = async (id: string, newActive: boolean) => {
    await updateDoc(doc(db, 'employees', id), { active: newActive });
    setEmployees(prev => prev.map(e => (e.id === id ? { ...e, active: newActive } : e)));
  };

  const filteredEmployees = selectedCompanyId
    ? employees.filter(e => {
        const lowerName = e.name.toLowerCase();
        const matchName = lowerName.includes(search.toLowerCase());
        const matchArray =
          Array.isArray((e as any).companyIds) &&
          (e as any).companyIds.includes(selectedCompanyId);
        const matchSingle = e.companyId && e.companyId === selectedCompanyId;
        return (matchArray || matchSingle) && matchName;
      })
    : [];

  const filteredClients = selectedCompanyId
    ? clients.filter(c => c.companyIds?.includes(selectedCompanyId))
    : clients;

  // When opening the profile modal, fetch checks for this employee
  const openProfile = async (emp: Employee) => {
    setProfileEmployee(emp);
    setProfileEdit({ ...emp });
    setProfileOpen(true);
    setProfileLoading(true);
    // Fetch checks for this employee
    const checksSnap = await getDocs(query(collection(db, 'checks'), where('employeeId', '==', emp.id)));
    setProfileChecks(checksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setProfileLoading(false);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Employees
      </Typography>

      {selectedCompanyId ? (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button variant="outlined" onClick={() => setSelectedCompanyId(null)}>
              ← Back to Companies
            </Button>
            <Button variant="contained" onClick={() => setOpenAdd(true)}>
              + Add Employee
            </Button>
            <TextField
              placeholder="Search employees"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Box>
          <Typography variant="h6" gutterBottom>
            {getCompanyName(selectedCompanyId)}
          </Typography>

          {filteredEmployees.length === 0 ? (
            <Typography>No employees in this company.</Typography>
          ) : (
            filteredEmployees.map((emp) => (
              <Box
  key={emp.id}
  sx={{
    border: '1px solid #ccc',
    borderRadius: 2,
    p: 2,
    mt: 2,
    maxWidth: 600,
    mx: 'auto',
    boxShadow: 1
  }}
>

                <Typography variant="h6">{emp.name}</Typography>
                <Typography variant="body2">📍 {emp.address}</Typography>
                <Typography variant="body2">
                  💼 {emp.position} | ${isNaN(emp.payRate) ? '0.00' : emp.payRate}/{emp.payType === 'hourly' ? 'hour' : 'day'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  👤 {getClientName(emp.clientId)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  📅 Start Date: {emp.startDate ? new Date(emp.startDate).toLocaleDateString() : 'N/A'}
                </Typography>
                <Typography
  variant="body2"
  sx={{
    fontWeight: 'bold',
    color: emp.active ? 'green' : 'red',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }}
>
  {emp.active ? '✅ Active' : '❌ Inactive'}
</Typography>

                <Button
                  variant="outlined"
                  sx={{ mt: 1 }}
                  onClick={() => openProfile(emp)}
                >
                  View Profile
                </Button>
              </Box>
            ))
          )}
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button variant="contained" onClick={() => setOpenAdd(true)}>
              + Add Employee
            </Button>
          </Box>

          <Typography variant="h6" gutterBottom>Select a Company:</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {companies.map((c) => (
              <Button
                key={c.id}
                variant="contained"
                onClick={() => {
                  setSelectedCompanyId(c.id);
                  setNewEmployee(prev => ({ ...prev, companyIds: [c.id] }));
                }}
                sx={{ justifyContent: 'flex-start' }}
              >
                {c.name}
              </Button>
            ))}
          </Box>
        </>
      )}

      {/* Add Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Employee</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Name" value={newEmployee.name} onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}/>
          <TextField label="Address" value={newEmployee.address} onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}/>
          <TextField label="Position" value={newEmployee.position} onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}/>
          <FormControl fullWidth>
            <InputLabel>Pay Type</InputLabel>
            <Select value={newEmployee.payType} onChange={(e) => setNewEmployee({ ...newEmployee, payType: e.target.value })}>
              <MenuItem value="hourly">Hourly</MenuItem>
              <MenuItem value="perdiem">Per Diem</MenuItem>
            </Select>
          </FormControl>
          {/* ✅ Start Date outside Select */}
          <TextField
            label="Start Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={newEmployee.startDate}
            onChange={(e) => setNewEmployee({ ...newEmployee, startDate: e.target.value })}
          />
          <TextField
            label={newEmployee.payType === 'hourly' ? 'Pay Rate (per hour)' : 'Per Diem Amount'}
            type="number"
            value={newEmployee.payRate}
            onChange={(e) => setNewEmployee({ ...newEmployee, payRate: e.target.value })}
          />
          <FormControl fullWidth>
            <InputLabel>Client</InputLabel>
            <Select
              value={newEmployee.clientId}
              onChange={(e) => setNewEmployee({ ...newEmployee, clientId: e.target.value })}
            >
              {filteredClients.length > 0 ? (
                filteredClients.map(cl => (
                  <MenuItem key={cl.id} value={cl.id}>
                    {cl.name} {cl.address ? `(${cl.address})` : ''}
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled>No clients available</MenuItem>
              )}
            </Select>
          </FormControl>
          {!selectedCompanyId && (
            <FormControl fullWidth>
              <InputLabel>Companies</InputLabel>
              <Select
                multiple
                value={newEmployee.companyIds}
                onChange={(e) => setNewEmployee({ ...newEmployee, companyIds: e.target.value as string[] })}
                renderValue={(selected) => (selected as string[]).map(id => getCompanyName(id)).join(', ')}
              >
                {companies.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Employee</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name"
            variant="outlined"
            fullWidth
            value={editEmployee.name}
            onChange={(e) => setEditEmployee({ ...editEmployee, name: e.target.value })}
            InputLabelProps={{ shrink: true, sx: { fontWeight: 'bold' } }}
          />
          <TextField
            label="Address"
            variant="outlined"
            fullWidth
            value={editEmployee.address}
            onChange={(e) => setEditEmployee({ ...editEmployee, address: e.target.value })}
            InputLabelProps={{ shrink: true, sx: { fontWeight: 'bold' } }}
          />
          <TextField
            label="Position"
            variant="outlined"
            fullWidth
            value={editEmployee.position}
            onChange={(e) => setEditEmployee({ ...editEmployee, position: e.target.value })}
            InputLabelProps={{ shrink: true, sx: { fontWeight: 'bold' } }}
          />
          <FormControl fullWidth variant="outlined">
            <InputLabel sx={{ fontWeight: 'bold' }}>Pay Type</InputLabel>
            <Select
              value={editEmployee.payType}
              onChange={(e) => setEditEmployee({ ...editEmployee, payType: e.target.value })}
              label="Pay Type"
            >
              <MenuItem value="hourly">Hourly</MenuItem>
              <MenuItem value="perdiem">Per Diem</MenuItem>
            </Select>
          </FormControl>
          {/* ✅ Edit Start Date */}
          <TextField
            label="Start Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={editEmployee.startDate}
            onChange={(e) => setEditEmployee({ ...editEmployee, startDate: e.target.value })}
          />
          <TextField
            label={editEmployee.payType === 'hourly' ? 'Pay Rate (per hour)' : 'Per Diem Amount'}
            variant="outlined"
            fullWidth
            type="number"
            value={editEmployee.payRate}
            onChange={(e) => setEditEmployee({ ...editEmployee, payRate: e.target.value })}
            InputLabelProps={{ shrink: true, sx: { fontWeight: 'bold' } }}
          />
          <FormControl fullWidth variant="outlined">
            <InputLabel sx={{ fontWeight: 'bold' }}>Company</InputLabel>
            <Select
              value={editEmployee.companyId}
              onChange={(e) => setEditEmployee({ ...editEmployee, companyId: e.target.value })}
              label="Company"
            >
              <MenuItem value="">No Company</MenuItem>
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={handleDeleteEmployee} sx={{ mr: 'auto' }}>
            Delete
          </Button>
          <Button onClick={() => setOpenEdit(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog
  open={profileOpen}
  onClose={() => setProfileOpen(false)}
  maxWidth="md"
  fullWidth
  PaperProps={{
    sx: {
      width: '700px',
      maxWidth: '90%',
    },
  }}
>

        <DialogTitle>Employee Profile</DialogTitle>
        <DialogContent>
          {profileEdit && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
            <Avatar sx={{ width: 80, height: 80, mb: 2 }}>
              {profileEdit && profileEdit.name ? String(profileEdit.name[0]).toUpperCase() : '?'}
            </Avatar>
          
            <Box sx={{ width: '100%', maxWidth: 600 }}>
              <TextField
                fullWidth
                label="Name"
                value={profileEdit.name || ''}
                onChange={e => setProfileEdit({ ...profileEdit, name: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Position"
                value={profileEdit.position || ''}
                onChange={e => setProfileEdit({ ...profileEdit, position: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Address"
                value={profileEdit.address || ''}
                onChange={e => setProfileEdit({ ...profileEdit, address: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Pay Rate"
                type="number"
                value={profileEdit.payRate || ''}
                onChange={e => setProfileEdit({ ...profileEdit, payRate: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Pay Type"
                value={profileEdit.payType || ''}
                onChange={e => setProfileEdit({ ...profileEdit, payType: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={profileEdit.startDate || ''}
                onChange={e => setProfileEdit({ ...profileEdit, startDate: e.target.value })}
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" sx={{ mb: 1 }}>
                <b>Company:</b> {getCompanyName(profileEdit.companyId)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <b>Client:</b> {profileEdit.clientId ? getClientName(profileEdit.clientId) : 'N/A'}
              </Typography>
              <FormControlLabel
  control={
    <Switch
      checked={!!profileEdit.active}
      onChange={e => setProfileEdit({ ...profileEdit, active: e.target.checked })}
      color="primary"
    />
  }
  label={
    <Typography sx={{ fontWeight: 'bold', color: profileEdit.active ? 'green' : 'red', display: 'flex', alignItems: 'center', gap: 1 }}>
      {profileEdit.active ? '✅ Active' : '❌ Inactive'}
    </Typography>
  }
  sx={{ mt: 1 }}
/>


            </Box>
            <DialogContent>
  {profileEdit && (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
        ...
      </Box>

      {profileChecks.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>Paycheck History</Typography>
          <Box sx={{ maxHeight: 250, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f5f5f5' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Amount</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {profileChecks.map((check) => (
                  <tr key={check.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>
                      {check.date?.toDate ? check.date.toDate().toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '8px' }}>${check.amount ?? '0.00'}</td>
                    <td style={{ padding: '8px' }}>{check.reviewed ? '✅ Paid' : '🕒 Unpaid'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>
      )}
    </>
  )}
</DialogContent>

          </Box>
          
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={async () => {
              if (!profileEdit) return;
              await updateDoc(doc(db, 'employees', profileEdit.id), profileEdit);
              setEmployees(prev => prev.map(emp => emp.id === profileEdit.id ? { ...emp, ...profileEdit } : emp));
              setProfileEmployee({ ...profileEdit });
              setProfileOpen(false);
            }}
            variant="contained"
          >
            Save
          </Button>
          <Button onClick={() => setProfileOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Employees;
