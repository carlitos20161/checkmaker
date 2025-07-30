import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Box,
} from "@mui/material";

interface Company {
  id: string;
  name: string;
  address: string;
  logoBase64?: string;
}

interface Client {
  id: string;
  name: string;
  address?: string;
  companyIds?: string[]; 
}




interface Bank {
  id: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  startingCheckNumber: string;
  companyId?: string;
}

const CompaniesManager: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  const [openForm, setOpenForm] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logoFile, setLogoFile] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      // fetch companies
      const snap = await getDocs(collection(db, "companies"));
      const cList: Company[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name ?? "",
          address: data.address ?? "",
          logoBase64: data.logoBase64 ?? "",
        };
      });
      setCompanies(cList);


      // fetch clients
const clientSnap = await getDocs(collection(db, "clients"));
const clList: Client[] = clientSnap.docs.map((d) => {
  const data = d.data() as any;
  return {
    id: d.id,
    name: data.name ?? "",
    address: data.address ?? "",
    companyIds: data.companyId || [], 
  };
});
setClients(clList);


      // fetch banks
      const bankSnap = await getDocs(collection(db, "banks"));
      const bList: Bank[] = bankSnap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          bankName: data.bankName ?? "",
          routingNumber: data.routingNumber ?? "",
          accountNumber: data.accountNumber ?? "",
          startingCheckNumber: data.startingCheckNumber ?? "",
          companyId: data.companyId ?? "",
        };
      });
      setBanks(bList);

      setLoading(false);
    };
    fetchAll().catch(console.error);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenForm = () => {
    setName("");
    setAddress("");
    setLogoFile(null);
    setOpenForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a company name");
      return;
    }
    try {
      await addDoc(collection(db, "companies"), {
        name,
        address,
        logoBase64: logoFile || "",
        createdAt: serverTimestamp(),
      });
      window.location.reload(); // quick refresh
    } catch (err) {
      console.error(err);
      alert("❌ Failed to save company");
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    setCompanyToDelete(company);
    setOpenDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!companyToDelete) return;

    try {
      // Check for related data
      const relatedBanks = banks.filter(b => b.companyId === companyToDelete.id);
      const relatedClients = clients.filter(c => c.companyIds?.includes(companyToDelete.id));
      
      // Check for checks
      const checksSnap = await getDocs(query(collection(db, "checks"), where("companyId", "==", companyToDelete.id)));
      const relatedChecks = checksSnap.docs.length;
      
      // Check for employees
      const employeesSnap = await getDocs(query(collection(db, "employees"), where("companyId", "==", companyToDelete.id)));
      const relatedEmployees = employeesSnap.docs.length;

      let warningMessage = `Are you sure you want to delete "${companyToDelete.name}"?\n\n`;
      let hasRelatedData = false;

      if (relatedBanks.length > 0) {
        warningMessage += `⚠️ This company has ${relatedBanks.length} associated bank(s)\n`;
        hasRelatedData = true;
      }
      if (relatedClients.length > 0) {
        warningMessage += `⚠️ This company has ${relatedClients.length} associated client(s)\n`;
        hasRelatedData = true;
      }
      if (relatedChecks > 0) {
        warningMessage += `⚠️ This company has ${relatedChecks} associated check(s)\n`;
        hasRelatedData = true;
      }
      if (relatedEmployees > 0) {
        warningMessage += `⚠️ This company has ${relatedEmployees} associated employee(s)\n`;
        hasRelatedData = true;
      }

      if (hasRelatedData) {
        warningMessage += "\n⚠️ Deleting this company will also delete all associated data!";
      }

      if (!window.confirm(warningMessage)) {
        setOpenDeleteDialog(false);
        setCompanyToDelete(null);
        return;
      }

      // Delete related data first
      for (const bank of relatedBanks) {
        await deleteDoc(doc(db, "banks", bank.id));
      }

      // Remove company from clients' companyIds arrays
      for (const client of relatedClients) {
        const updatedCompanyIds = client.companyIds?.filter(id => id !== companyToDelete.id) || [];
        await updateDoc(doc(db, "clients", client.id), { companyId: updatedCompanyIds });
      }

      // Delete checks
      for (const checkDoc of checksSnap.docs) {
        await deleteDoc(doc(db, "checks", checkDoc.id));
      }

      // Delete employees
      for (const employeeDoc of employeesSnap.docs) {
        await deleteDoc(doc(db, "employees", employeeDoc.id));
      }

      // Finally delete the company
      await deleteDoc(doc(db, "companies", companyToDelete.id));

      // Update local state
      setCompanies(prev => prev.filter(c => c.id !== companyToDelete.id));
      setBanks(prev => prev.filter(b => b.companyId !== companyToDelete.id));
      setClients(prev => prev.map(c => ({
        ...c,
        companyIds: c.companyIds?.filter(id => id !== companyToDelete.id) || []
      })));

      setOpenDeleteDialog(false);
      setCompanyToDelete(null);
      alert("✅ Company deleted successfully!");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to delete company");
    }
  };

  if (loading) return <Typography>Loading companies...</Typography>;

  return (
    <Paper sx={{ p: 3, maxWidth: 1000, margin: "0 auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4">Companies</Typography>
        <Button variant="contained" color="primary" onClick={handleOpenForm}>
          + Create New Company
        </Button>
      </Box>
  
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {companies.map((c) => {
  const relatedBanks = banks.filter((b) => b.companyId === c.id);
  const relatedClients = clients.filter((cl) => cl.companyIds?.includes(c.id));


  return (
    <Paper key={c.id} sx={{ p: 2 }} elevation={3}>
      {/* Company header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <ListItemAvatar>
            {c.logoBase64 ? (
              <Avatar src={c.logoBase64} alt={c.name} sx={{ width: 56, height: 56, mr: 2 }} />
            ) : (
              <Avatar sx={{ width: 56, height: 56, mr: 2 }}>{c.name.charAt(0)}</Avatar>
            )}
          </ListItemAvatar>
          <Box>
            <Typography variant="h6">{c.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              Address: {c.address || "N/A"}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => handleDeleteCompany(c)}
          sx={{ ml: 2 }}
        >
          Delete
        </Button>
      </Box>

      {/* Banks */}
      <Box sx={{ mt: 2, ml: 1 }}>
        {relatedBanks.length > 0 ? (
          <>
            <Typography variant="subtitle2">Banks:</Typography>
            {relatedBanks.map((bank) => (
              <Typography key={bank.id} sx={{ fontSize: 14, color: "text.secondary", ml: 1 }}>
                • {bank.bankName} (Acct: {bank.accountNumber}, Routing: {bank.routingNumber})
              </Typography>
            ))}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            No banks associated.
          </Typography>
        )}
      </Box>

      {/* Clients */}
      <Box sx={{ mt: 2, ml: 1 }}>
        {relatedClients.length > 0 ? (
          <>
            <Typography variant="subtitle2">Clients:</Typography>
            {relatedClients.map((client) => (
              <Typography key={client.id} sx={{ fontSize: 14, color: "text.secondary", ml: 1 }}>
                • {client.name}
                {client.address && ` (${client.address})`}
              </Typography>
            ))}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            No clients associated.
          </Typography>
        )}
      </Box>
    </Paper>
  );
})}

      </Box>
  
      {/* Dialog for creating new company remains the same */}
      <Dialog
        open={openForm}
        onClose={() => setOpenForm(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create Company</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            fullWidth
            label="Company Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            fullWidth
            label="Company Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Button variant="contained" component="label">
            Upload Company Logo
            <input type="file" accept="image/*" hidden onChange={handleFileChange} />
          </Button>
          {logoFile && <Typography sx={{ mt: 1, mb: 1 }}>✅ Logo ready</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => {
          setOpenDeleteDialog(false);
          setCompanyToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Company</DialogTitle>
        <DialogContent>
          {companyToDelete && (
            <Typography>
              Are you sure you want to delete "{companyToDelete.name}"?
              <br /><br />
              This action will also delete all associated:
              <br />• Banks
              <br />• Employees  
              <br />• Checks
              <br />• Client associations
              <br /><br />
              This action cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setOpenDeleteDialog(false);
              setCompanyToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={confirmDelete}
          >
            Delete Company
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
  
};

export default CompaniesManager;
