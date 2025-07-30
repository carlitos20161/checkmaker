import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  Paper,
} from "@mui/material";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  runTransaction,
  doc,
  query,
  where,
  getDoc,
} from "firebase/firestore";

interface Company {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  payRate: number;
  payType: string;
  companyId?: string | null;
  companyIds?: string[];
  active: boolean;  
}

interface PayInput {
  hours: string;
  otHours: string;
  holidayHours: string;
  memo: string;
}

const BatchChecks: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null
  );

  const [selectedEmployees, setSelectedEmployees] = useState<{
    [id: string]: boolean;
  }>({});

  const [inputs, setInputs] = useState<{ [id: string]: PayInput }>({});

  useEffect(() => {
    const fetchData = async () => {
      const compSnap = await getDocs(collection(db, "companies"));
      setCompanies(
        compSnap.docs.map((d) => ({ id: d.id, name: d.data().name }))
      );

      const empSnap = await getDocs(collection(db, "employees"));
      setEmployees(
        empSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee))
      );
    };
    fetchData();
  }, []);

  const filteredEmployees = selectedCompanyId
  ? employees.filter((e) => {
      if (!e.active) return false; // Exclude inactive employees
      const matchArray =
        Array.isArray((e as any).companyIds) &&
        (e as any).companyIds.includes(selectedCompanyId);
      const matchSingle = e.companyId === selectedCompanyId;
      return matchArray || matchSingle;
    })
  : [];


  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => ({ ...prev, [id]: !prev[id] }));
    setInputs((prev) => ({
      ...prev,
      [id]:
        prev[id] || {
          hours: "",
          otHours: "",
          holidayHours: "",
          memo: "",
        },
    }));
  };

  const handleInputChange = (id: string, field: keyof PayInput, value: string) => {
    setInputs((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const calculateAmount = (emp: Employee, data: PayInput) => {
    const baseRate = emp.payRate || 0;
    const hours = parseFloat(data.hours) || 0;
    const otHours = parseFloat(data.otHours) || 0;
    const holidayHours = parseFloat(data.holidayHours) || 0;

    const total =
      hours * baseRate +
      otHours * baseRate * 1.5 +
      holidayHours * baseRate * 2;

    return total.toFixed(2);
  };

  const handleCreateChecks = async () => {
    const selectedIds = Object.keys(selectedEmployees).filter(
      (id) => selectedEmployees[id]
    );
    
    // Get the bank for this company to get the starting check number
    const bankSnap = await getDocs(query(collection(db, "banks"), where("companyId", "==", selectedCompanyId)));
    const bank = bankSnap.docs[0]?.data() as any;
    const startingCheckNumber = bank ? parseInt(bank.startingCheckNumber) || 1 : 1;
    
    console.log(`🏦 Bank starting check number: ${startingCheckNumber}`);
    
    for (const id of selectedIds) {
      const emp = employees.find((e) => e.id === id);
      if (!emp) continue;
      const data = inputs[id];
      const amount = parseFloat(calculateAmount(emp, data)) || 0;

      // ✅ Firestore transaction to increment nextCheckNumber and create the check
      const companyRef = doc(db, "companies", selectedCompanyId!);
      await runTransaction(db, async (transaction) => {
        const companySnap = await transaction.get(companyRef);
        let nextNum = startingCheckNumber;
        
        if (companySnap.exists()) {
          const current = companySnap.data().nextCheckNumber;
          // If company has no nextCheckNumber or it's less than startingCheckNumber, use startingCheckNumber
          if (!current || current < startingCheckNumber) {
            nextNum = startingCheckNumber;
            transaction.update(companyRef, { nextCheckNumber: startingCheckNumber + 1 });
          } else {
            nextNum = current + 1;
            transaction.update(companyRef, { nextCheckNumber: nextNum });
          }
        } else {
          transaction.set(companyRef, { nextCheckNumber: startingCheckNumber + 1 }, { merge: true });
        }

        // --- NEW: Check if user is admin ---
        let isAdmin = false;
        if (auth.currentUser?.uid) {
          const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          isAdmin = userSnap.exists() && userSnap.data().role === 'admin';
        }

        // add the new check with extra fields
        const checksRef = collection(db, "checks");
        const newDoc = doc(checksRef);
        transaction.set(newDoc, {
  companyId: selectedCompanyId,
  employeeId: id,
  employeeName: emp.name,
  amount,
  memo: data.memo || "",
  hours: parseFloat(data.hours) || 0,
  otHours: parseFloat(data.otHours) || 0,
  holidayHours: parseFloat(data.holidayHours) || 0,
  payRate: emp.payRate,            // store base rate
  payType: emp.payType || "",      // optional
  date: new Date(),
  status: "pending",
  createdBy: auth.currentUser?.uid || null,
  madeByName: auth.currentUser?.email || "Unknown",
  checkNumber: nextNum,
  reviewed: isAdmin,
});

      });
    }
    alert("✅ Checks created!");
    setSelectedEmployees({});
    setInputs({});
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Batch Checks
      </Typography>

      {!selectedCompanyId ? (
        <>
          <Typography variant="h6">Select a Company:</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2 }}>
            {companies.map((c) => (
              <Button
                key={c.id}
                variant="contained"
                onClick={() => setSelectedCompanyId(c.id)}
                sx={{ maxWidth: 300, textAlign: "left" }}
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
            onClick={() => setSelectedCompanyId(null)}
          >
            ← Back to Companies
          </Button>

          <Typography variant="h6" gutterBottom>
            Employees in{" "}
            {companies.find((c) => c.id === selectedCompanyId)?.name}
          </Typography>

          {filteredEmployees.map((emp) => (
            <Paper
              key={emp.id}
              sx={{ p: 2, mt: 2, display: "flex", flexDirection: "column" }}
              elevation={2}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!selectedEmployees[emp.id]}
                    onChange={() => toggleEmployee(emp.id)}
                  />
                }
                label={
                  <Typography variant="subtitle1" fontWeight="bold">
                    {emp.name}
                  </Typography>
                }
              />

              {selectedEmployees[emp.id] && (
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 2,
                    mt: 1,
                  }}
                >
                  <TextField
                    label="Hours"
                    type="number"
                    value={inputs[emp.id]?.hours || ""}
                    onChange={(e) =>
                      handleInputChange(emp.id, "hours", e.target.value)
                    }
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="OT Hours"
                    type="number"
                    value={inputs[emp.id]?.otHours || ""}
                    onChange={(e) =>
                      handleInputChange(emp.id, "otHours", e.target.value)
                    }
                    sx={{ width: 120 }}
                  />
                  <TextField
                    label="Holiday Hours"
                    type="number"
                    value={inputs[emp.id]?.holidayHours || ""}
                    onChange={(e) =>
                      handleInputChange(emp.id, "holidayHours", e.target.value)
                    }
                    sx={{ width: 140 }}
                  />
                  <TextField
                    label="Memo (optional)"
                    value={inputs[emp.id]?.memo || ""}
                    onChange={(e) =>
                      handleInputChange(emp.id, "memo", e.target.value)
                    }
                    sx={{ flex: 1, minWidth: 200 }}
                  />
                  <TextField
                    label="Calculated Amount"
                    value={calculateAmount(emp, inputs[emp.id] || {})}
                    InputProps={{ readOnly: true }}
                    sx={{ width: 160 }}
                  />
                </Box>
              )}
            </Paper>
          ))}

          {filteredEmployees.length > 0 && (
            <Button
              variant="contained"
              sx={{ mt: 4 }}
              color="primary"
              onClick={handleCreateChecks}
            >
              Create Checks
            </Button>
          )}
        </>
      )}
    </Box>
  );
};

export default BatchChecks;
