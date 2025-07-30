import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Avatar,
  Paper,
  Divider,
  CircularProgress,
  Card,
  CardContent,
} from "@mui/material";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DashboardProps {
  // ✅ now include createdBy
  onGoToViewChecks: (companyId: string, weekKey: string, createdBy: string) => void;
}

interface ReviewRequest {
  id: string;
  weekKey: string;
  companyId: string;
  createdBy: string;
  reviewed?: boolean;
}

interface Company {
  id: string;
  name: string;
  address: string;
  logoBase64?: string;
}
interface Employee {
  id: string;
  name: string;
}
interface Client {
  id: string;
  name: string;
}
interface Check {
  id: string;
  amount: number;
  companyId: string;
  employeeName: string;
  memo?: string;
  status?: string;
  date?: any;
  createdBy?: string;
}

interface UserInfo {
  id: string;
  username: string;
  email?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onGoToViewChecks }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [recentChecks, setRecentChecks] = useState<Check[]>([]);
  const [usersMap, setUsersMap] = useState<{ [uid: string]: UserInfo }>({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const cSnap = await getDocs(collection(db, "companies"));
        setCompanies(cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

        const eSnap = await getDocs(collection(db, "employees"));
        setEmployees(eSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

        const clSnap = await getDocs(collection(db, "clients"));
        setClients(clSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

        const uSnap = await getDocs(collection(db, "users"));
        const map: { [uid: string]: UserInfo } = {};
        uSnap.docs.forEach((docu) => {
          const data = docu.data() as any;
          map[data.uid || docu.id] = {
            id: docu.id,
            username: data.username || data.email || "Unknown",
            email: data.email,
          };
        });
        setUsersMap(map);

        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setLoading(false);
      }
    };
    fetchBaseData();
  }, []);

  useEffect(() => {
    const fetchRoleAndChecks = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        let role = "user";
        if (snap.exists()) {
          const data = snap.data() as any;
          role = data.role || "user";
        }
        setCurrentRole(role);

        const q = query(collection(db, "checks"), orderBy("date", "desc"));
        const snapChecks = await getDocs(q);
        let checks: Check[] = snapChecks.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        if (role !== "admin") {
          checks = checks.filter((c) => c.createdBy === user.uid);
        }
        setRecentChecks(checks.slice(0, 6));
      } catch (err) {
        console.error("Error fetching checks:", err);
      }
    };
    fetchRoleAndChecks();
  }, []);

  useEffect(() => {
    const fetchReviewRequests = async () => {
      if (currentRole !== "admin") return;
      const snap = await getDocs(collection(db, "reviewRequest"));
      const reqs: ReviewRequest[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setReviewRequests(reqs.filter((r) => !r.reviewed));
    };
    fetchReviewRequests();
  }, [currentRole]);

  if (loading) {
    return (
      <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const chartData = [
    { name: "Companies", count: companies.length },
    { name: "Employees", count: employees.length },
    { name: "Clients", count: clients.length },
  ];

  return (
  <Box
    sx={{
      mt: 4,
      display: "flex",
      justifyContent: "center",
      background: "linear-gradient(to bottom right, #f0f4ff, #ffffff)",
      minHeight: "100vh",
      p: 3,
    }}
  >
    <Paper
      elevation={4}
      sx={{
        p: 4,
        borderRadius: 4,
        width: "100%",
        maxWidth: 1300,
        backgroundColor: "#ffffff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: "bold", color: "#1976d2" }}>
            📊 Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Live overview of your data from Firestore
          </Typography>
        </Box>
        {currentRole && (
          <Button
            variant="contained"
            sx={{
              borderRadius: 3,
              textTransform: "none",
              backgroundColor: currentRole === "admin" ? "#2e7d32" : "#1976d2",
              fontWeight: "bold",
              boxShadow: "0 3px 10px rgba(0,0,0,0.15)",
              px: 3,
              py: 1,
            }}
          >
            Logged in as: {currentRole.toUpperCase()}
          </Button>
        )}
      </Box>

      {/* SUMMARY CARDS */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 3,
          mb: 4,
        }}
      >
        <Card
          sx={{
            p: 2,
            borderRadius: 3,
            background:
              "linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(25,118,210,0.3)",
            transition: "transform 0.2s ease",
            "&:hover": { transform: "translateY(-4px)" },
          }}
        >
          <CardContent>
            <Typography variant="h6">Companies</Typography>
            <Typography variant="h3" sx={{ fontWeight: "bold" }}>
              {companies.length}
            </Typography>
          </CardContent>
        </Card>

        <Card
          sx={{
            p: 2,
            borderRadius: 3,
            background:
              "linear-gradient(135deg, #43a047 0%, #66bb6a 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(67,160,71,0.3)",
            transition: "transform 0.2s ease",
            "&:hover": { transform: "translateY(-4px)" },
          }}
        >
          <CardContent>
            <Typography variant="h6">Employees</Typography>
            <Typography variant="h3" sx={{ fontWeight: "bold" }}>
              {employees.length}
            </Typography>
          </CardContent>
        </Card>

        <Card
          sx={{
            p: 2,
            borderRadius: 3,
            background:
              "linear-gradient(135deg, #ef6c00 0%, #ffa726 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(239,108,0,0.3)",
            transition: "transform 0.2s ease",
            "&:hover": { transform: "translateY(-4px)" },
          }}
        >
          <CardContent>
            <Typography variant="h6">Clients</Typography>
            <Typography variant="h3" sx={{ fontWeight: "bold" }}>
              {clients.length}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* REVIEW REQUESTS */}
      {currentRole === "admin" && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
            🔔 Pending Review Requests
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 4 }}>
            {reviewRequests.length === 0 ? (
              <Typography>No review requests found.</Typography>
            ) : (
              reviewRequests.map((req) => {
                const companyName =
                  companies.find((c) => c.id === req.companyId)?.name ||
                  "Unknown Company";
                const creatorName =
                  usersMap[req.createdBy]?.username || "Unknown";
                return (
                  <Paper
                    key={req.id}
                    sx={{
                      p: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      borderRadius: 3,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      transition: "0.2s",
                      "&:hover": { bgcolor: "#f5f5f5" },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onGoToViewChecks(req.companyId, req.weekKey, req.createdBy);
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                        📌 Week {req.weekKey} – {companyName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Made by: {creatorName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Requires review before printing
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGoToViewChecks(req.companyId, req.weekKey, req.createdBy);
                      }}
                      sx={{ borderRadius: 3, px: 3, fontWeight: "bold" }}
                    >
                      Review
                    </Button>
                  </Paper>
                );
              })
            )}
          </Box>
        </>
      )}

      {/* CHART */}
      <Divider sx={{ my: 3 }} />
      <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
        📈 Overview Chart
      </Typography>
      <Box
        sx={{
          height: 300,
          mb: 4,
          borderRadius: 3,
          backgroundColor: "#fff",
          boxShadow: "inset 0 0 10px rgba(0,0,0,0.05)",
          p: 2,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#1976d2" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* RECENT CHECKS */}
      <Divider sx={{ my: 3 }} />
      <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
        💳 Recent Checks
      </Typography>
      {recentChecks.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 3,
          }}
        >
          {recentChecks.map((check) => {
            const company = companies.find((c) => c.id === check.companyId);
            const creatorName =
              check.createdBy && usersMap[check.createdBy]
                ? usersMap[check.createdBy].username
                : "Unknown";
            return (
              <Card
                key={check.id}
                sx={{
                  borderRadius: 3,
                  boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
                  transition: "0.2s",
                  "&:hover": { transform: "translateY(-3px)" },
                }}
              >
                <CardContent sx={{ display: "flex", gap: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: "#1976d2",
                      width: 48,
                      height: 48,
                      fontWeight: "bold",
                    }}
                  >
                    {company?.name?.charAt(0) || "C"}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                      {company?.name || "Unknown Company"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Employee: {check.employeeName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Amount: ${check.amount?.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Memo: {check.memo || "—"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Created By: {creatorName}
                    </Typography>
                    {check.date && (
                      <Typography variant="caption" color="text.secondary">
                        {check.date.toDate
                          ? check.date.toDate().toLocaleString()
                          : check.date}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      ) : (
        <Typography>No recent checks found.</Typography>
      )}
    </Paper>
  </Box>
);

};

export default Dashboard;
