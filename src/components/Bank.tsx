import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

interface Bank {
  id: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  startingCheckNumber: string;
  companyId?: string;
}

interface Company {
  id: string;
  name: string;
}

const BankPage: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // for details dialog
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);

  // for add dialog
  const [openForm, setOpenForm] = useState(false);
  const [bankName, setBankName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [startingCheckNumber, setStartingCheckNumber] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  // fetch banks
  const fetchBanks = async () => {
    const snap = await getDocs(collection(db, "banks"));
    const list: Bank[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        bankName: String(data.bankName ?? ""),
        routingNumber: String(data.routingNumber ?? ""),
        accountNumber: String(data.accountNumber ?? ""),
        startingCheckNumber: String(data.startingCheckNumber ?? ""),
        companyId: String(data.companyId ?? "")
      };
    });
    setBanks(list);
  };

  // fetch companies
  const fetchCompanies = async () => {
    const snap = await getDocs(collection(db, "companies"));
    const list: Company[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: String(data.name ?? "")
      };
    });
    setCompanies(list);
  };

  useEffect(() => {
    fetchBanks().catch(console.error);
    fetchCompanies().catch(console.error);
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this bank?")) return;
    await deleteDoc(doc(db, "banks", id));
    setOpenDetails(false);
    fetchBanks().catch(console.error);
  };

  const handleSave = async () => {
    if (!bankName.trim() || !routingNumber.trim() || !accountNumber.trim() || !selectedCompanyId.trim()) {
      alert("Please fill in all fields");
      return;
    }
    await addDoc(collection(db, "banks"), {
      bankName,
      routingNumber,
      accountNumber,
      startingCheckNumber,
      companyId: selectedCompanyId,
      createdAt: serverTimestamp(),
    });
    setOpenForm(false);
    setBankName("");
    setRoutingNumber("");
    setAccountNumber("");
    setStartingCheckNumber("");
    setSelectedCompanyId("");
    fetchBanks().catch(console.error);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ maxWidth: 600, mx: "auto", p: 3 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Banks
        </Typography>

        <Button
          variant="contained"
          color="primary"
          sx={{ mb: 2 }}
          onClick={() => setOpenForm(true)}
        >
          + Add Bank
        </Button>

        {banks.length === 0 ? (
          <Typography>No banks found.</Typography>
        ) : (
          <List>
            {banks.map((bank) => {
              const company = companies.find((c) => c.id === bank.companyId);
              return (
                <React.Fragment key={bank.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => {
                        setSelectedBank(bank);
                        setOpenDetails(true);
                      }}
                    >
                      <ListItemText
                        primary={bank.bankName || "(No name)"}
                        secondary={`Routing: ${bank.routingNumber} | Account: ${bank.accountNumber} | Start#: ${bank.startingCheckNumber}${
                          company ? ` | Company: ${company.name}` : ""
                        }`}
                      />
                    </ListItemButton>
                  </ListItem>
                  <Divider />
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Paper>

      {/* Add Bank Dialog */}
      <Dialog
        open={openForm}
        onClose={() => setOpenForm(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add Bank</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
        >
          <TextField
            label="Bank Name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <TextField
            label="Routing Number"
            value={routingNumber}
            onChange={(e) => setRoutingNumber(e.target.value)}
          />
          <TextField
            label="Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <TextField
            label="Starting Check Number"
            value={startingCheckNumber}
            onChange={(e) => setStartingCheckNumber(e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel id="company-select-label">Select Company</InputLabel>
            <Select
              labelId="company-select-label"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
            >
              {companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Bank Details</DialogTitle>
        <DialogContent>
          {selectedBank && (
            <>
              <Typography>Name: {selectedBank.bankName}</Typography>
              <Typography>Routing: {selectedBank.routingNumber}</Typography>
              <Typography>Account: {selectedBank.accountNumber}</Typography>
              <Typography>
                Starting Check #: {selectedBank.startingCheckNumber}
              </Typography>
              {selectedBank.companyId && (
                <Typography>
                  Company: {companies.find((c) => c.id === selectedBank.companyId)?.name || "N/A"}
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {selectedBank && (
            <Button color="error" onClick={() => handleDelete(selectedBank.id)}>
              Delete
            </Button>
          )}
          <Button onClick={() => setOpenDetails(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BankPage;
