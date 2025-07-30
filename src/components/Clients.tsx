import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
  MenuItem,
  Select,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  Autocomplete,
  CardContent,
  Divider,
} from "@mui/material";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InputLabel, FormControl } from '@mui/material';

import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, doc } from "firebase/firestore";

interface Client {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  companyIds?: string[]; // ✅ store multiple company IDs
  active: boolean;
}

interface Company {
  id: string;
  name: string;
  address?: string;
}

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filter, setFilter] = useState("All");

  // Dialog states
  const [openForm, setOpenForm] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    companyIds: [] as string[],
  });

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      const clientSnap = await getDocs(collection(db, "clients"));
      const clientList: Client[] = clientSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        address: d.data().address,
        contactPerson: d.data().contactPerson,
        contactEmail: d.data().contactEmail,
        contactPhone: d.data().contactPhone,
        companyIds: d.data().companyId || [], // ✅ Firestore field is an array
        active: d.data().active ?? true,
      }));
      setClients(clientList);

      const companySnap = await getDocs(collection(db, "companies"));
      const companyList: Company[] = companySnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        address: d.data().address,
      }));
      setCompanies(companyList);
    };
    fetchData();
  }, []);

  const handleSaveCompanyChange = async () => {
    if (!selectedClient) return;
    await updateDoc(doc(db, "clients", selectedClient.id), {
      companyId: selectedClient.companyIds || [],
    });
    setClients((prev) =>
      prev.map((c) =>
        c.id === selectedClient.id
          ? { ...c, companyIds: selectedClient.companyIds || [] }
          : c
      )
    );
    alert("✅ Company list updated!");
  };

  // Open create form
  const handleOpenForm = () => {
    setFormData({
      name: "",
      address: "",
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      companyIds: [],
    });
    setOpenForm(true);
  };

  // Form field change
  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save new client
  const handleSaveClient = async () => {
    if (!formData.name.trim()) return;
    const newClientData = {
      name: formData.name,
      address: formData.address || "",
      contactPerson: formData.contactPerson || "",
      contactEmail: formData.contactEmail || "",
      contactPhone: formData.contactPhone || "",
      companyId: formData.companyIds || [], // ✅ store array
      active: true,
      createdAt: new Date(),
    };
    const docRef = await addDoc(collection(db, "clients"), newClientData);
    setClients((prev) => [
      ...prev,
      { id: docRef.id, ...newClientData } as Client,
    ]);
    setOpenForm(false);
  };

  // Toggle active status
  const handleToggleActive = async (id: string, newActive: boolean) => {
    await updateDoc(doc(db, "clients", id), { active: newActive });
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: newActive } : c))
    );
  };

  // Open details dialog
  const handleOpenDetails = (client: Client) => {
    setSelectedClient(client);
    setOpenDetails(true);
  };

  const displayedClients =
    filter === "All"
      ? clients
      : clients.filter((c) => (filter === "Active" ? c.active : !c.active));

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Clients
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="All">All Clients</MenuItem>
          <MenuItem value="Active">Active</MenuItem>
          <MenuItem value="Inactive">Inactive</MenuItem>
        </Select>

        <Button variant="contained" onClick={handleOpenForm}>
          Create Client
        </Button>
      </Box>

      {displayedClients.map((client) => (
        <Box
          key={client.id}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
            cursor: "pointer",
            "&:hover": { backgroundColor: "#f0f4f8" },
            p: 1.5,
            borderRadius: 2,
            boxShadow: 1,
          }}
          onClick={() => handleOpenDetails(client)}
        >
          <Typography fontSize={16}>
            {client.name}{" "}
            {client.companyIds && client.companyIds.length > 0
              ? "(Companies linked)"
              : "(Miscellaneous)"}
          </Typography>
          <FormControlLabel
            onClick={(e) => e.stopPropagation()}
            control={
              <Switch
                checked={client.active}
                onChange={(e) =>
                  handleToggleActive(client.id, e.target.checked)
                }
              />
            }
            label={client.active ? "Active" : "Inactive"}
          />
        </Box>
      ))}

      {/* Dialog for creating a client */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Client</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
        >
          <TextField
            label="Client Name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
          <TextField
            label="Address"
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
          />
          <TextField
            label="Contact Person"
            value={formData.contactPerson}
            onChange={(e) => handleChange("contactPerson", e.target.value)}
          />
          <TextField
            label="Contact Email"
            value={formData.contactEmail}
            onChange={(e) => handleChange("contactEmail", e.target.value)}
          />
          <TextField
            label="Contact Phone"
            value={formData.contactPhone}
            onChange={(e) => handleChange("contactPhone", e.target.value)}
          />

          <Autocomplete
            multiple
            options={companies}
            getOptionLabel={(option) => option.name}
            onChange={(e, newValues) => {
              handleChange(
                "companyIds",
                newValues.map((v) => v.id)
              );
            }}
            renderInput={(params) => (
              <TextField {...params} label="Assign Companies" variant="outlined" />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSaveClient}>
            Save Client
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating details dialog */}
      <Dialog
        open={openDetails}
        onClose={() => setOpenDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle fontWeight="bold">Client & Company Details</DialogTitle>
        <DialogContent>
          {selectedClient && (
            <Card sx={{ mb: 3, p: 2, backgroundColor: "#f9f9f9" }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Client Info
                </Typography>
                <Divider sx={{ mb: 1 }} />
                <Typography>Name: {selectedClient.name}</Typography>
                <Typography>Address: {selectedClient.address || "N/A"}</Typography>
                <Typography>
                  Contact Person: {selectedClient.contactPerson || "N/A"}
                </Typography>
                <Typography>
                  Email: {selectedClient.contactEmail || "N/A"}
                </Typography>
                <Typography>
                  Phone: {selectedClient.contactPhone || "N/A"}
                </Typography>
                <Typography>
                  Status: {selectedClient.active ? "Active" : "Inactive"}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Editable Company Assignment */}
          <Box sx={{ mb: 3 }}>
            <Autocomplete
              multiple
              value={companies.filter((c) =>
                selectedClient?.companyIds?.includes(c.id)
              )}
              options={companies}
              getOptionLabel={(option) => option.name}
              onChange={(e, newValues) => {
                const newCompanyIds = newValues.map((v) => v.id);
                setSelectedClient((prev) =>
                  prev ? { ...prev, companyIds: newCompanyIds } : null
                );
              }}
              renderInput={(params) => (
                <TextField {...params} label="Assign Companies" variant="outlined" />
              )}
              sx={{ mb: 2 }}
            />

            <Button
              sx={{ mt: 2 }}
              variant="contained"
              color="primary"
              onClick={handleSaveCompanyChange}
            >
              Save Company Change
            </Button>
          </Box>

          {selectedClient?.companyIds?.length ? (
            selectedClient.companyIds.map((cid) => {
              const comp = companies.find((c) => c.id === cid);
              return (
                <Typography key={cid}>
                  {comp ? `${comp.name} – ${comp.address || "N/A"}` : "(Unknown company)"}
                </Typography>
              );
            })
          ) : (
            <Typography>No company linked</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetails(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clients;
