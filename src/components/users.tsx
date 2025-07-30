import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc, // ✅ added setDoc
} from "firebase/firestore";
import { db, auth } from "../firebase"; // ✅ import auth
import { createUserWithEmailAndPassword } from "firebase/auth"; // ✅ import createUserWithEmailAndPassword
import {
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Box,
  Chip,
  FormControlLabel,
  Switch,
} from "@mui/material";

interface Company {
  id: string;
  name: string;
}

interface User {
  id: string;
  username: string;
  email?: string;
  password: string;
  role: string;
  active: boolean;
  companyIds?: string[];
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user dialog
  const [openForm, setOpenForm] = useState(false);
  const [email, setEmail] = useState(""); // ✅ added email
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [companyIds, setCompanyIds] = useState<string[]>([]);

  // Details dialog
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editCompanies, setEditCompanies] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);

  // fetch data
  const fetchAll = async () => {
    const snapUsers = await getDocs(collection(db, "users"));
    const uList: User[] = snapUsers.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        username: data.username,
        email: data.email || "",
        password: data.password,
        role: data.role,
        active: data.active ?? true,
        companyIds: Array.isArray(data.companyIds) ? data.companyIds : [],
      };
    });
    setUsers(uList);

    const snapCompanies = await getDocs(collection(db, "companies"));
    const cList: Company[] = snapCompanies.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: data.name,
      };
    });
    setCompanies(cList);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll().catch(console.error);
  }, []);

  // ✅ Updated to also create Auth user
  const handleSave = async () => {
    if (!email.trim() || !username.trim() || !password.trim()) {
      alert("Please enter email, username and password");
      return;
    }
    try {
      // 1. Create in Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Save extra profile data in Firestore with UID as doc ID
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email,
        username,
        password, // ⚠️ for demo only; avoid storing plain text in production
        role,
        active: true,
        companyIds,
        createdAt: serverTimestamp(),
      });

      setOpenForm(false);
      setEmail("");
      setUsername("");
      setPassword("");
      setRole("user");
      setCompanyIds([]);
      fetchAll();
      alert("✅ User created and can now log in!");
    } catch (err: any) {
      console.error(err);
      alert("❌ Failed to create user: " + err.message);
    }
  };

  const handleOpenDetails = (user: User) => {
    setSelectedUser(user);
    setEditPassword(user.password);
    setEditCompanies(user.companyIds || []);
    setEditActive(user.active);
    setOpenDetails(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    await updateDoc(doc(db, "users", selectedUser.id), {
      password: editPassword,
      active: editActive,
      companyIds: editCompanies,
    });
    setOpenDetails(false);
    fetchAll();
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    await deleteDoc(doc(db, "users", selectedUser.id));
    setOpenDetails(false);
    fetchAll();
  };

  if (loading) return <Typography>Loading users...</Typography>;

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Users
      </Typography>

      <Button
        variant="contained"
        color="primary"
        sx={{ mb: 2 }}
        onClick={() => setOpenForm(true)}
      >
        + Create User
      </Button>

      <List>
        {users.map((u) => {
          const assignedCompanies = u.companyIds
            ?.map((cid) => companies.find((c) => c.id === cid)?.name)
            .filter(Boolean)
            .join(", ");
          return (
            <React.Fragment key={u.id}>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleOpenDetails(u)}>
                  <ListItemText
                    primary={`${u.username} (${u.role})`}
                    secondary={
                      <>
                        <Typography variant="body2" color="text.secondary">
                          {u.email ? `Email: ${u.email}` : "No email"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {assignedCompanies
                            ? `Companies: ${assignedCompanies}`
                            : "No companies assigned"}
                        </Typography>
                      </>
                    }
                  />

                </ListItemButton>
              </ListItem>
              <Divider />
            </React.Fragment>
          );
        })}
      </List>

      {/* Create User Dialog */}
      <Dialog
        open={openForm}
        onClose={() => setOpenForm(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create User</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
        >
          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel id="role-label">Role</InputLabel>
            <Select
              labelId="role-label"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="user">User</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="companies-label">Assign Companies</InputLabel>
            <Select
              labelId="companies-label"
              multiple
              value={companyIds}
              onChange={(e) =>
                setCompanyIds(
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : (e.target.value as string[])
                )
              }
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(selected as string[]).map((value) => {
                    const company = companies.find((c) => c.id === value);
                    return <Chip key={value} label={company?.name || value} />;
                  })}
                </Box>
              )}
            >
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog
        open={openDetails}
        onClose={() => setOpenDetails(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>User Details</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <Typography>Username: {selectedUser?.username}</Typography>
          <TextField
            label="Password"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
          />
          <FormControlLabel
            control={
              <Switch
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
              />
            }
            label={editActive ? "Active" : "Inactive"}
          />
          <FormControl fullWidth>
            <InputLabel id="edit-companies-label">Assign Companies</InputLabel>
            <Select
              labelId="edit-companies-label"
              multiple
              value={editCompanies}
              onChange={(e) =>
                setEditCompanies(
                  typeof e.target.value === "string"
                    ? e.target.value.split(",")
                    : (e.target.value as string[])
                )
              }
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(selected as string[]).map((value) => {
                    const company = companies.find((c) => c.id === value);
                    return <Chip key={value} label={company?.name || value} />;
                  })}
                </Box>
              )}
            >
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          {selectedUser && (
            <Button color="error" onClick={handleDeleteUser}>
              Delete User
            </Button>
          )}
          <Button onClick={() => setOpenDetails(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateUser}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default UsersPage;
