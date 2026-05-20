import React, { useState, useEffect } from "react";
import logo from "./logo.png";
import { db } from "./firebase";
import { deleteDoc } from "firebase/firestore";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs
} from "firebase/firestore";

function App() {
  // ================= STATE =================
  const [po, setPo] = useState("");
  const [result, setResult] = useState(null);
  const [poExists, setPoExists] = useState(false);
  const [newPO, setNewPO] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newStatus, setNewStatus] = useState("Received");
  const [newNotes, setNewNotes] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  const [activePOs, setActivePOs] = useState([]);
  const [showActivePOs, setShowActivePOs] = useState(false);

  const [locationSearch, setLocationSearch] = useState("");
  const [bayResults, setBayResults] = useState([]);

  const [loading, setLoading] = useState(false);

  const [sortMode, setSortMode] = useState("created");

  const normalizePO = (value = "") => value.trim().toUpperCase();

  // ================= AUTO LOAD ACTIVE POs =================
  useEffect(() => {
    fetchActivePOs();
  }, []);
  useEffect(() => {
  if (!newPO.trim()) return;

  const timer = setTimeout(async () => {
    try {
      const normalizedPO = normalizePO(newPO);

      const ref = doc(db, "pos", normalizedPO);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setPoExists(false);

        setNewLocation("");
        setNewNotes("");
        setNewStatus("Received");

        return;
      }

      const data = snap.data();

      setPoExists(true);
      
      setNewLocation(data.Location || "");
      setNewStatus(data.Status || "Received");
      setNewNotes(data.notes || "");

    } catch (err) {
      console.error("Auto-load error:", err);
    }
  }, 500);

  return () => clearTimeout(timer);

}, [newPO]);

  // ================= STYLE =================
  const cardStyle = {
    background: "#fff",
    padding: "12px",
    marginTop: "10px",
    borderRadius: "8px",
    border: "1px solid #ddd"
  };

  const inputStyle = {
    padding: "8px",
    marginRight: "8px",
    marginTop: "5px"
  };

  // ================= WAREHOUSE MAP =================
  const WAREHOUSE_BAYS = {
    A: Array.from({ length: 64 }, (_, i) => i + 1)
  .filter(bay => ![19,20,21,22].includes(bay)),
    B: [1,2,3,4,5,6,7,8,9,10,11],
    C: [7,8,9,10,11,12,13,14,15,16,17,18,19,20,23,24,25,26,28,32,33,34,35,36,37,39,40,41,42,43,44,45],
    D: Array.from({ length: 38 }, (_, i) => i + 1)
  };

  // ================= BAY PARSER (FIXED) =================
  const parseLocations = (locationString = "") => {
    return locationString
      .toUpperCase()
      .split(/[\s,]+/)   // supports "A4 A5", "A4,A5"
      .filter(Boolean);
  };

  const getBayUsage = (warehouseId) => {
  const usage = {};

  activePOs.forEach((p) => {
    if (!p.LocationList) return;

    p.LocationList.forEach((loc) => {
      const match = loc.match(/([A-D])(\d+)/);
      if (!match) return;

      const w = match[1];
      const bay = match[2];

      if (w !== warehouseId) return;

      usage[bay] = (usage[bay] || 0) + 1;
    });
  });

  return usage;
};

  const getEmptyBays = (warehouseId) => {
    const usage = getBayUsage(warehouseId);
    return WAREHOUSE_BAYS[warehouseId].filter(
      (bay) => !usage[String(bay)]
    );
  };

  const getWarehouseStats = (warehouseId) => {
    const total = WAREHOUSE_BAYS[warehouseId].length;
    const used = Object.keys(getBayUsage(warehouseId)).length;

    return {
      total,
      used,
      percent: ((used / total) * 100).toFixed(1)
    };
  };


  // ================= SEARCH =================
const handleSearch = async () => {
  if (!po) return;

  setLoading(true);

  let snap;

  try {
    const normalizedPO = normalizePO(po);
    snap = await getDoc(doc(db, "pos", normalizedPO));
  } catch (err) {
    console.error(err);
    toast.error("Error fetching PO");
    setLoading(false);
    return; // 🚨 IMPORTANT
  }

  if (!snap.exists()) {
    setResult({
      Location: "N/A",
      Status: "Not Yet Received",
      Notes: "No record in system",
      createdAt: "N/A",
      lastUpdated: "N/A"
    });
    setLoading(false);
    return;
  }

  const r = snap.data();

  setResult({
    Location: r.Location,
    Status: r.Status,
    Notes: r.notes || "None",
    createdAt: r.createdAt?.toDate?.().toLocaleString() || "N/A",
    lastUpdated: r.lastUpdated?.toDate?.().toLocaleString() || "N/A"
  });

  setLoading(false);
};
  // ================= ADD =================
const handleAddPO = async () => {
  if (!newPO || !newLocation) {
    toast.warning("Fill all fields");
    return;
  }

  setLoading(true);

  try {
    const normalizedPO = normalizePO(newPO);
    const formattedLocation = newLocation
      .toUpperCase()
      .replace(/\s+/g, ",");

    const ref = doc(db, "pos", normalizedPO);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      toast.warning("Duplicate PO");
      return;
    }

    await setDoc(ref, {
  Location: formattedLocation,
  Status: newStatus,
  notes: newNotes,
  createdAt: serverTimestamp(),
  lastUpdated: serverTimestamp()
});

toast.success("PO Added");

    // ✅ clear form AFTER success
    setNewPO("");
    setNewLocation("");
    setNewStatus("Received");
    setNewNotes("");

    await fetchActivePOs();

  } catch (err) {
    console.error(err);
    toast.error("Error adding PO");
  } finally {
    setLoading(false);
  }
};
const handleAdminLogin = () => {
  if (adminPassword === "warehouse4901") {
    setIsAdmin(true);
    setAdminPassword("");
  } else {
    toast.error("Incorrect password");
  }
};

  // ================= UPDATE =================
const handleUpdatePO = async () => {
  if (
  !newLocation.trim() &&
  !newStatus &&
  !newNotes.trim()
) {
  return toast.info("No changes to update");
}

  if (!newPO) return toast.warning("Enter PO in Admin Panel");

  try {
    const normalizedPO = normalizePO(newPO);
    const ref = doc(db, "pos", normalizedPO);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return toast.error("PO not found in database");
    }

    const updateData = {
      Status: newStatus,
      notes: newNotes,
      lastUpdated: serverTimestamp()
    };

    if (newLocation.trim()) {
      updateData.Location = newLocation
        .toUpperCase()
        .replace(/\s+/g, ",");
    }

    await updateDoc(ref, updateData);

    toast.success("PO Updated");

    // optional cleanup (keeps admin ready for next edit)
    setNewLocation("");
    setNewNotes("");

    // refresh warehouse view
    await fetchActivePOs();

  } catch (error) {
  console.error("Update error:", error);
  toast.error("Error updating PO");
}
};

  // ================= ACTIVE POS =================
const fetchActivePOs = async () => {
  setLoading(true);

  try {
    const snap = await getDocs(collection(db, "pos"));

    const data = snap.docs.map((d) => {
      const raw = d.data();

      const locationList = (raw.Location || "")
        .toUpperCase()
        .split(/[\s,]+/)
        .filter(Boolean);

      return {
        id: d.id,
        ...raw,
        LocationList: locationList
      };
    });

    setActivePOs(
      data.filter((p) => p.Status !== "Delivered")
    );

  } catch (err) {
    console.error(err);
    toast.error("Error loading active POs");
  } finally {
    setLoading(false);
  }
};

const getSortedPOs = () => {
  const sorted = [...activePOs];

  switch (sortMode) {
    case "po":
      return sorted.sort((a, b) =>
        String(a.id).localeCompare(String(b.id))
      );

    case "warehouse":
      return sorted.sort((a, b) => {
        const aLoc = a.LocationList?.[0] || a.Location || "";
        const bLoc = b.LocationList?.[0] || b.Location || "";

        const aMatch = aLoc.match(/([A-D])(\d+)/);
        const bMatch = bLoc.match(/([A-D])(\d+)/);

        if (!aMatch || !bMatch) return 0;

        const [, aW, aBay] = aMatch;
        const [, bW, bBay] = bMatch;

        if (aW !== bW) return aW.localeCompare(bW);

        return Number(aBay) - Number(bBay);
      });

    case "status":
      const statusOrder = {
        "Received": 1,
        "Partially Received": 2,
        "Not Received": 3,
        "Moved to WOS Stock": 4,
        "Moved to Builders Stock": 5,
        "Partially Delivered": 6,
        "Delivered": 7
      };

      return sorted.sort((a, b) => {
        const aVal = statusOrder[a.Status] || 999;
        const bVal = statusOrder[b.Status] || 999;
        return aVal - bVal;
      });

    case "created":
    default:
      return sorted.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime; // newest first
      });
  }
};

  // ================= BAY SEARCH =================
  const searchByLocation = async () => {
  if (!locationSearch.trim()) return;

  setLoading(true);

  try {
    // const normalizedSearch = locationSearch.toUpperCase();

    const results = activePOs.filter(p =>
  p.Status !== "Delivered" &&
  parseLocations(p.Location).includes(locationSearch.toUpperCase())
);

    if (results.length === 0) {
      setBayResults([{ open: true }]); // open bay
    } else {
      setBayResults(results);
    }

  } catch (err) {
    console.error(err);
    toast.error("Error searching location");
  } finally {
    setLoading(false);
  }
};

const handleDeletePO = async () => {
  if (!newPO) return toast.warning("Enter PO to delete");

  const confirmDelete = window.confirm(
    `Are you sure you want to DELETE PO ${newPO}? This cannot be undone.`
  );

  if (!confirmDelete) return;

  setLoading(true);

  try {
    const normalizedPO = normalizePO(newPO);
    const ref = doc(db, "pos", normalizedPO);

    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return toast.info("PO not found");
    }

    await deleteDoc(ref);

    toast.success(`PO ${normalizedPO} deleted`);

    setNewPO("");

    await fetchActivePOs();

  } catch (err) {
    console.error(err);
    toast.error("Error deleting PO");
  } finally {
    setLoading(false);
  }
};

  // ================= UI =================

const pageStyle = {
  padding: 20,
  fontFamily: "Arial",
  background: "#f4f6f8",
  display: "flex",
  flexDirection: "column",
  gap: "12px"
};

const loadingOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999
};

const loadingBoxStyle = {
  background: "white",
  padding: "20px 30px",
  borderRadius: "10px",
  fontSize: "18px",
  fontWeight: "bold",
  boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
};

return (

 <div style={pageStyle}>

  <ToastContainer
  position="top-center"
  autoClose={2500}
  hideProgressBar={false}
  newestOnTop
  closeOnClick
  pauseOnHover
  theme="colored"
/>

  {loading && (
  <div style={loadingOverlayStyle}>
    <div style={loadingBoxStyle}>
      Loading...
    </div>
  </div>
)}

    <img
      src={logo}
      alt="Warehouse Logo"
      style={{
        width: "100%",
        maxWidth: "500px",
        display: "block",
        margin: "0 auto 20px auto"
      }}
    />

    {/* SEARCH */}
    <div style={cardStyle}>
      <h2>Search PO</h2>

      <input
  value={po}
  onChange={e => setPo(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  }}
/>
      <button onClick={handleSearch}>Search</button>

      {result && !result.error && (
        <div>
          <div>Location: {result.Location}</div>
          <div>Status: {result.Status}</div>
          <div>Notes: {result.Notes}</div>
          <div>Updated: {result.lastUpdated}</div>
        </div>
      )}
    </div>

   

    {/* BAY SEARCH */}
    <div style={cardStyle}>
      <h2>Bay Search</h2>

    <input
  value={locationSearch}
  onChange={(e) => setLocationSearch(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      searchByLocation();
    }
  }}
/>
      <button onClick={searchByLocation}>Search</button>

      <div style={{ marginTop: 10 }}>
        {bayResults.length === 0 ? null : (
          bayResults.length === 1 && bayResults[0]?.open ? (
            <div style={{ fontWeight: "bold", color: "green" }}>
              Open Bay ({locationSearch.toUpperCase()})
            </div>
          ) : (
            bayResults.map((p) => (
              <div key={p.id} style={cardStyle}>
                <div><strong>PO:</strong> {p.id}</div>
                <div><strong>Location:</strong> {p.Location}</div>
                <div><strong>Status:</strong> {p.Status}</div>
                <div><strong>Notes:</strong> {p.notes || "None"}</div>
              </div>
            ))
          )
        )}
      </div>
    </div>

     {/* MODE */}
    {/* ADMIN ACCESS */}
{!isAdmin ? (
  <div style={cardStyle}>
    <h2>Admin Login</h2>

    <input
  type="password"
  placeholder="Enter password"
  value={adminPassword}
  onChange={(e) => setAdminPassword(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      handleAdminLogin();
    }
  }}
/>

    <button style={{ marginLeft: 8 }} onClick={handleAdminLogin}>
      Login
    </button>
  </div>
) : (
  <button
    style={{ marginTop: 10 }}
    onClick={() => setIsAdmin(false)}
  >
    Exit Admin Mode
  </button>
)}

    {/* ADMIN */}
    {isAdmin && (
      <div style={cardStyle}>
        <h2>Admin</h2>

{/* PO INPUT (MISSING RIGHT NOW) */}
<input
  style={inputStyle}
  placeholder="PO"
  value={newPO}
  onChange={(e) => setNewPO(e.target.value)}
/>
<div style={{ marginTop: 5, fontWeight: "bold" }}>
  {newPO && (
    poExists ? (
      <span style={{ color: "orange" }}>
        Existing PO Loaded
      </span>
    ) : (
      <span style={{ color: "green" }}>
        New PO
      </span>
    )
  )}
</div>
{/* LOCATION */}
<input
  style={inputStyle}
  placeholder="Location (e.g. A4 A5)"
  value={newLocation}
  onChange={(e) => setNewLocation(e.target.value)}
/>

{/* NOTES */}
<input
  style={inputStyle}
  placeholder="Notes"
  value={newNotes}
  onChange={(e) => setNewNotes(e.target.value)}
/>

{/* STATUS */}
<select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
  <option>Received</option>
  <option>Partially Received</option>
  <option>Partially Delivered</option>
  <option>Delivered</option>
  <option>Not Received</option>
</select>

        <div>
  <button
    onClick={handleAddPO}
    disabled={poExists}
  >
  Add
  </button>
  <button
  onClick={handleUpdatePO}
  disabled={!poExists}
  >
  Update
  </button>

  <button
    style={{
      marginLeft: 8,
      background: "red",
      color: "white"
    }}
    onClick={handleDeletePO}
  >
    Delete
  </button>
</div>
      </div>
    )}

{/* ACTIVE POS */}
<div style={cardStyle}>
  <h2>Active Warehouse POs</h2>

  <div style={{ marginTop: 10, fontWeight: "bold" }}>
    ACTIVE COUNT: {activePOs.length}
  </div>

  <button
    style={{ marginTop: 10 }}
    onClick={() => {
      if (showActivePOs) {
        setShowActivePOs(false);
      } else {
        fetchActivePOs();
        setShowActivePOs(true);
      }
    }}
  >
    {showActivePOs ? "Hide Active POs" : "Show Active POs"}
  </button>
  {/* SORT DROPDOWN */}
<div style={{ marginTop: 10 }}>
  <label style={{ marginRight: 8 }}>Sort:</label>

  <select
    value={sortMode}
    onChange={(e) => setSortMode(e.target.value)}
  >
    <option value="created">Newest First</option>
    <option value="po">PO Number</option>
    <option value="warehouse">Warehouse Location</option>
    <option value="status">Status</option>
  </select>
</div>
{showActivePOs && (
  <div style={{ marginTop: 10 }}>
    {getSortedPOs().map((p) => (
      <div key={p.id} style={cardStyle}>
        <div><strong>PO:</strong> {p.id}</div>
        <div><strong>Location:</strong> {p.Location}</div>
        <div><strong>Status:</strong> {p.Status}</div>
      </div>
    ))}
  </div>
)}

</div>

    {/* CAPACITY */}
    {isAdmin && (
      <div style={cardStyle}>
        <h2>Capacity</h2>

        {["A","B","C","D"].map(w => {
          const stats = getWarehouseStats(w);
          const empty = getEmptyBays(w);

          return (
            <div key={w}>
              <h3>{w}</h3>
              <div>{stats.used}/{stats.total} ({stats.percent}%)</div>
              <div>Open: {empty.join(", ")}</div>
            </div>
          );
        })}
      </div>
    )}

  </div>
);
}

export default App;