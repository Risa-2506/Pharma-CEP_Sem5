import React, { useState, useEffect } from 'react';
import { 
  Package, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  ChevronRight, 
  Building2, 
  RefreshCw,
  Search,
  Truck,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Lock,
  Camera,
  Upload,
  QrCode,
  FileCheck2,
  FileText,
  Boxes,
  Check,
  X,
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';

export default function DistributorDashboard({ 
  user, 
  batches = [], 
  onRefresh, 
  loading = false,
  showToast = () => {}
}) {
  const [activeSubTab, setActiveSubTab] = useState('incoming'); // 'incoming', 'inventory', 'history'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Scan & Receive Verification Modal State
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [batchToVerify, setBatchToVerify] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [receiving, setReceiving] = useState(false);
  const [receiveSuccess, setReceiveSuccess] = useState(null);
  const [newSealId, setNewSealId] = useState('');

  // Transfer to Wholesaler Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [batchToTransfer, setBatchToTransfer] = useState(null);
  const [authorizedWholesalers, setAuthorizedWholesalers] = useState([]);
  const [allWholesalers, setAllWholesalers] = useState([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState('');
  const [transferSealId, setTransferSealId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [loadingRules, setLoadingRules] = useState(false);

  const myOrgId = String(user?.organizationId || '');

  // Filter batches for this distributor
  // 1. Incoming Deliveries: batches addressed to this distributor that are In Transit
  const incomingDeliveries = (batches || []).filter(b => 
    String(b.currentHolderId) === myOrgId && b.status === 'In Transit'
  );

  // 2. Verified Inventory: batches held by this distributor that are verified / in custody
  const inventoryBatches = (batches || []).filter(b => 
    String(b.currentHolderId) === myOrgId && b.status !== 'In Transit'
  );

  // 3. Outgoing Transfers: batches originally received by this distributor and transferred onward
  const outgoingTransfers = (batches || []).filter(b => 
    (b.transferHistory || []).some(t => String(t.senderOrgId) === myOrgId)
  );

  // KPI Metrics calculation
  const totalIncoming = incomingDeliveries.length;
  const awaitingVerification = incomingDeliveries.filter(b => b.verificationStatus !== 'Verified').length || totalIncoming;
  const verifiedInventoryCount = inventoryBatches.length;
  const outgoingCount = outgoingTransfers.length;

  // Search filtering
  const currentList = activeSubTab === 'incoming' 
    ? incomingDeliveries 
    : activeSubTab === 'inventory' 
      ? inventoryBatches 
      : outgoingTransfers;

  const filteredList = currentList.filter(b => 
    b.batchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.medicineName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Open Scan & Receive Modal
  const openScanModal = (batch, e) => {
    if (e) e.stopPropagation();
    setBatchToVerify(batch);
    setImageFile(null);
    setImagePreview(null);
    setScanResult(null);
    setScanError('');
    setReceiveSuccess(null);
    setNewSealId(`SEAL-DIST-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsScanModalOpen(true);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setScanResult(null);
      setScanError('');
    }
  };

  // Perform AI Extraction & Comparison against Original Manufacturer Baseline
  const handleExecuteScanVerification = async () => {
    if (!imageFile) {
      setScanError('Please select or capture a medicine packaging image.');
      return;
    }

    setIsScanning(true);
    setScanError('');
    setScanResult(null);

    try {
      // 1. Send image to AI extraction service (Groq Vision / Local OCR)
      const aiExtractRes = await api.extractMedicineImage(imageFile);
      const aiExtracted = aiExtractRes.medicineInfo || {};

      // 2. Call backend to verify extracted fields against original Manufacturer baseline
      const verifyRes = await api.verifyBatchStageScan(batchToVerify.batchId, aiExtracted);

      setScanResult({
        ...verifyRes.verification,
        originalBaseline: verifyRes.originalBaseline,
        aiExtracted: verifyRes.aiExtracted,
      });

      if (verifyRes.verification?.verified) {
        showToast('Medicine packaging verified successfully against Manufacturer baseline!', 'success');
      } else {
        showToast('Verification mismatch detected! Discrepancy logged with Regulatory Authority.', 'error');
      }
    } catch (err) {
      setScanError(err.message || 'AI package extraction failed. Ensure the medicine label is clear.');
    } finally {
      setIsScanning(false);
    }
  };

  // Confirm Physical Receipt and Accept Custody
  const handleConfirmReceipt = async () => {
    if (!scanResult || !scanResult.verified) {
      setScanError('Cannot accept custody: Medicine package must pass AI verification against original baseline.');
      return;
    }

    setReceiving(true);
    setScanError('');

    try {
      const res = await api.receiveBatch(batchToVerify.batchId, scanResult, newSealId);
      setReceiveSuccess(res);
      showToast(`Batch ${batchToVerify.batchId} received into Distributor inventory successfully!`, 'success');
      if (onRefresh) onRefresh();
      setTimeout(() => {
        setIsScanModalOpen(false);
        setActiveSubTab('inventory');
      }, 1600);
    } catch (err) {
      setScanError(err.message || 'Receipt confirmation failed. Please try again.');
    } finally {
      setReceiving(false);
    }
  };

  // Open Transfer to Wholesaler Modal
  const openTransferModal = async (batch, e) => {
    if (e) e.stopPropagation();
    setBatchToTransfer(batch);
    setTransferError('');
    setTransferSuccess('');
    setSelectedReceiverId('');
    setTransferSealId(`SEAL-TR-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsTransferModalOpen(true);
    setLoadingRules(true);

    try {
      // 1. Fetch active organizations of type Wholesaler
      const orgsRes = await api.getOrganizations({ status: 'Active' });
      const orgList = orgsRes.organizations || [];
      const whList = orgList.filter(o => o.type === 'Wholesaler');
      setAllWholesalers(whList);

      // 2. Fetch supply chain rules configured by Regulatory Authority
      const rulesRes = await api.getSupplyChainRules();
      const rule = rulesRes.rules || rulesRes.rule || {};
      const transitions = rule.allowedTransitions || [];
      const relationships = rule.relationships || [];

      const myOrgName = user?.organizationName || '';
      const authorizedIds = new Set();
      const authorizedNames = new Set();

      // Check transitions: from Distributor -> Wholesaler
      transitions.forEach(t => {
        const fromMatches = (t.fromOrg === myOrgName) || (t.from === 'Distributor');
        if (fromMatches) {
          if (t.toOrg) authorizedNames.add(t.toOrg);
        }
      });

      // Check pipeline relationships: who comes immediately after Distributor
      if (relationships.length > 0) {
        let foundIdx = -1;
        relationships.forEach((rel, idx) => {
          if (rel.orgId === myOrgId || rel.orgName === myOrgName || rel.type === 'Distributor') {
            foundIdx = idx;
          }
        });
        if (foundIdx !== -1 && foundIdx + 1 < relationships.length) {
          const nextHop = relationships[foundIdx + 1];
          if (nextHop.orgId) authorizedIds.add(String(nextHop.orgId));
          if (nextHop.orgName) authorizedNames.add(nextHop.orgName);
        }
      }

      // Filter wholesalers that are authorized
      const filteredWholesalers = whList.filter(w => {
        if (authorizedIds.has(String(w._id)) || authorizedIds.has(String(w.id))) return true;
        if (authorizedNames.has(w.name)) return true;
        // If no strict per-org rules set, all active Wholesalers are authorized next-hop
        if (authorizedIds.size === 0 && authorizedNames.size === 0) return true;
        return false;
      });

      setAuthorizedWholesalers(filteredWholesalers);
      if (filteredWholesalers.length > 0) {
        setSelectedReceiverId(filteredWholesalers[0]._id || filteredWholesalers[0].id);
      }
    } catch (err) {
      setTransferError('Failed to load supply chain rules: ' + (err.message || 'Network error'));
    } finally {
      setLoadingRules(false);
    }
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    if (!selectedReceiverId) {
      setTransferError('Please select an authorized Wholesaler recipient.');
      return;
    }
    if (!transferSealId.trim()) {
      setTransferError('A transit tamper seal ID is required.');
      return;
    }

    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');

    try {
      const res = await api.transferBatch(batchToTransfer.batchId, {
        receiverId: selectedReceiverId,
        newSealId: transferSealId.trim(),
      });

      setTransferSuccess(res.message || 'Batch custody transferred successfully to Wholesaler on blockchain ledger!');
      if (onRefresh) onRefresh();
      setTimeout(() => {
        setIsTransferModalOpen(false);
      }, 1800);
    } catch (err) {
      setTransferError(err.message || 'Transfer failed. Verify authority rule authorization.');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="animate-slide" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Welcome Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(37, 99, 235, 0.1))',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)'
          }}>
            <Truck size={24} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Building2 size={12} /> {user?.organizationName}
            </div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              Distributor Logistics Hub
            </h1>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-medium)',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-medium)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Incoming Deliveries</span>
            <Truck size={14} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totalIncoming > 0 ? '#f59e0b' : '#fff' }}>
            {totalIncoming}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Awaiting receipt scan</div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-medium)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Verified Inventory</span>
            <Package size={14} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
            {verifiedInventoryCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Ready for Wholesaler transfer</div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-medium)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Discrepancies</span>
            <ShieldAlert size={14} color="#f43f5e" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f43f5e' }}>
            0
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Flagged packages</div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-medium)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Outgoing Transfers</span>
            <Boxes size={14} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>
            {outgoingCount}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Dispatched to Wholesalers</div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        border: '1px solid var(--border-subtle)',
        gap: '4px'
      }}>
        <button
          onClick={() => setActiveSubTab('incoming')}
          style={{
            flex: 1,
            padding: '8px 4px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: activeSubTab === 'incoming' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.2))' : 'transparent',
            color: activeSubTab === 'incoming' ? '#fbbf24' : 'var(--text-secondary)',
            fontWeight: activeSubTab === 'incoming' ? 700 : 500,
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Truck size={13} /> Incoming ({totalIncoming})
        </button>

        <button
          onClick={() => setActiveSubTab('inventory')}
          style={{
            flex: 1,
            padding: '8px 4px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: activeSubTab === 'inventory' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.2))' : 'transparent',
            color: activeSubTab === 'inventory' ? '#34d399' : 'var(--text-secondary)',
            fontWeight: activeSubTab === 'inventory' ? 700 : 500,
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Package size={13} /> Inventory ({verifiedInventoryCount})
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          style={{
            flex: 1,
            padding: '8px 4px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: activeSubTab === 'history' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeSubTab === 'history' ? '#38bdf8' : 'var(--text-secondary)',
            fontWeight: activeSubTab === 'history' ? 700 : 500,
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Clock size={13} /> Transferred ({outgoingCount})
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by batch ID or medicine name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px 10px 36px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            color: '#fff',
            fontSize: '0.82rem',
            outline: 'none'
          }}
        />
      </div>

      {/* Content List Based on Active Tab */}
      {filteredList.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border-medium)',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'rgba(100, 116, 139, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)'
          }}>
            {activeSubTab === 'incoming' ? <Truck size={24} /> : <Package size={24} />}
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
              {activeSubTab === 'incoming' 
                ? 'No Incoming Deliveries' 
                : activeSubTab === 'inventory' 
                  ? 'No Verified Inventory' 
                  : 'No Outgoing Transfers'}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '280px', marginTop: '4px' }}>
              {activeSubTab === 'incoming'
                ? 'When an authorized Manufacturer dispatches a batch to your distribution center, it will appear here for receipt verification.'
                : activeSubTab === 'inventory'
                  ? 'Perform physical AI scans on incoming shipments to verify baseline hashes and accept batches into your inventory.'
                  : 'Batches transferred onward to authorized Wholesalers will appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filteredList.map(batch => {
            const isIncoming = activeSubTab === 'incoming';
            const isInventory = activeSubTab === 'inventory';

            return (
              <div
                key={batch.batchId}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: isIncoming ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-medium)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Status Indicator Stripe */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: isIncoming ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #10b981, #059669)'
                }} />

                {/* Batch Identification Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Batch Number
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                      {batch.batchId}
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: isIncoming ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isIncoming ? '#fbbf24' : '#34d399',
                    border: isIncoming ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {isIncoming ? <Truck size={11} /> : <CheckCircle2 size={11} />}
                    {isIncoming ? 'In Transit / Awaiting Scan' : 'Verified in Inventory'}
                  </span>
                </div>

                {/* Medicine & Supply Chain Info */}
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                    {batch.medicineName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {batch.composition || 'Active Pharmaceutical Ingredients'}
                  </div>
                </div>

                {/* Metadata Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  fontSize: '0.72rem'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Manufacturer:</span>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{batch.manufacturerName}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Quantity:</span>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{batch.quantity?.toLocaleString()} units</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Transit Seal ID:</span>
                    <div style={{ fontFamily: 'var(--font-mono)', color: '#c084fc' }}>{batch.sealId}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Expiry Date:</span>
                    <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{batch.expiryDate}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                {isIncoming && (
                  <button
                    onClick={(e) => openScanModal(batch, e)}
                    style={{
                      marginTop: '0.25rem',
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
                    }}
                  >
                    <Camera size={15} /> Scan Medicine Package & Verify
                  </button>
                )}

                {isInventory && (
                  <button
                    onClick={(e) => openTransferModal(batch, e)}
                    style={{
                      marginTop: '0.25rem',
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <Truck size={15} /> Transfer Custody to Wholesaler <ArrowRight size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MEDICINE PACKAGE SCAN & RECEIPT VERIFICATION MODAL */}
      {/* ========================================================================= */}
      {isScanModalOpen && batchToVerify && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-medium)',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Camera size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                    Distributor Medicine Package Verification
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Batch: <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{batchToVerify.batchId}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsScanModalOpen(false)}
                disabled={isScanning || receiving}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {scanError && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                color: '#fca5a5',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{scanError}</span>
              </div>
            )}

            {/* Success Message */}
            {receiveSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                color: '#6ee7b7',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} />
                <span>Batch accepted into Distributor Inventory! Updating ledger...</span>
              </div>
            )}

            {/* Step 1: Package Image Upload & Scan */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <QrCode size={15} color="#06b6d4" />
                Physical Medicine Package Inspection
              </div>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Photograph or upload the physical medicine box/label. The AI engine will read printed package details and verify them directly against the original Manufacturer baseline.
              </p>

              {imagePreview ? (
                <div style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: '180px' }}>
                  <img src={imagePreview} alt="Package scan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <label
                    htmlFor="reselect-image"
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(0, 0, 0, 0.8)',
                      color: '#fff',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Change Photo
                  </label>
                  <input id="reselect-image" type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                </div>
              ) : (
                <label style={{
                  border: '2px dashed var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.75rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  background: 'rgba(0, 0, 0, 0.15)'
                }}>
                  <Upload size={24} color="#06b6d4" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>Click to capture or select photo</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Supports JPG, PNG, WEBP</span>
                  <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                </label>
              )}

              <button
                type="button"
                onClick={handleExecuteScanVerification}
                disabled={!imageFile || isScanning || receiving}
                style={{
                  width: '100%',
                  padding: '9px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: (!imageFile || isScanning) ? 'not-allowed' : 'pointer',
                  opacity: (!imageFile || isScanning) ? 0.6 : 1
                }}
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Reading package & verifying baseline...
                  </>
                ) : (
                  <>
                    <FileCheck2 size={15} /> Run AI Package Verification Scan
                  </>
                )}
              </button>
            </div>

            {/* Step 2: Verification Results (Field Comparison & Cryptographic Hash) */}
            {scanResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Status Alert Banner */}
                <div style={{
                  background: scanResult.verified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  border: scanResult.verified ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {scanResult.verified ? <CheckCircle2 size={18} color="#10b981" /> : <AlertCircle size={18} color="#f43f5e" />}
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: scanResult.verified ? '#10b981' : '#f43f5e' }}>
                        {scanResult.status}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        {scanResult.verified 
                          ? 'Package matches original Manufacturer baseline and cryptographic hash.'
                          : `Discrepancy detected on: ${scanResult.failedFields?.join(', ')}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Field-by-Field Comparison Table */}
                <div style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} color="#38bdf8" /> Field-Level Baseline Comparison
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(scanResult.fieldChecks || {}).map(([key, check]) => (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          background: 'rgba(0, 0, 0, 0.2)',
                          fontSize: '0.72rem'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{check.field}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            Expected: {check.expected || 'N/A'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.68rem', color: check.match ? '#94a3b8' : '#fca5a5' }}>
                            {check.extracted || 'Not detected'}
                          </span>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            background: check.match ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                            color: check.match ? '#10b981' : '#f43f5e'
                          }}>
                            {check.status || (check.match ? 'MATCH' : 'MISMATCH')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cryptographic Hash Comparison */}
                <div style={{
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.72rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Lock size={13} color="#c084fc" /> Cryptographic Integrity Audit
                    </span>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      background: scanResult.hashMatch ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                      color: scanResult.hashMatch ? '#10b981' : '#f43f5e'
                    }}>
                      {scanResult.hashMatch ? '✓ HASH MATCH' : '✗ HASH MISMATCH'}
                    </span>
                  </div>

                  <div style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <div>Trusted Hash: <span style={{ color: '#c084fc' }}>{scanResult.trustedDataHash}</span></div>
                    <div>Scanned Hash: <span style={{ color: scanResult.hashMatch ? '#10b981' : '#f43f5e' }}>{scanResult.scannedDataHash}</span></div>
                  </div>
                </div>

                {/* Step 3: Accept Receipt Button (Only enabled if verified) */}
                {scanResult.verified && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                        Warehouse Security Seal ID *
                      </label>
                      <input
                        type="text"
                        value={newSealId}
                        onChange={(e) => setNewSealId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-medium)',
                          color: '#fff',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.78rem'
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmReceipt}
                      disabled={receiving}
                      style={{
                        width: '100%',
                        padding: '11px',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: receiving ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      {receiving ? (
                        <>
                          <RefreshCw size={15} className="spin" /> Recording Custody on Ledger...
                        </>
                      ) : (
                        <>
                          <Check size={16} /> Confirm Receipt & Accept Custody
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TRANSFER TO WHOLESALER MODAL */}
      {/* ========================================================================= */}
      {isTransferModalOpen && batchToTransfer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-medium)',
            width: '100%',
            maxWidth: '500px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Truck size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                    Transfer Custody to Wholesaler
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Batch: <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{batchToTransfer.batchId}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsTransferModalOpen(false)}
                disabled={transferLoading}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {transferError && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                color: '#fca5a5',
                fontSize: '0.75rem'
              }}>
                {transferError}
              </div>
            )}

            {transferSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                color: '#6ee7b7',
                fontSize: '0.75rem'
              }}>
                {transferSuccess}
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Target Wholesaler (Authorized Route) *
                </label>
                {loadingRules ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Loading authorized wholesalers...</div>
                ) : authorizedWholesalers.length === 0 ? (
                  <div style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: '#fca5a5',
                    fontSize: '0.72rem'
                  }}>
                    No authorized Wholesalers configured by Regulatory Authority. Transfer is prevented.
                  </div>
                ) : (
                  <select
                    value={selectedReceiverId}
                    onChange={(e) => setSelectedReceiverId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: '#0d1526',
                      border: '1px solid var(--border-medium)',
                      color: '#fff',
                      colorScheme: 'dark',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  >
                    <option value="" style={{ background: '#0f172a', color: '#94a3b8' }}>-- Select Target Wholesaler --</option>
                    {authorizedWholesalers.map(w => (
                      <option key={w._id || w.id} value={w._id || w.id} style={{ background: '#0f172a', color: '#ffffff' }}>
                        {w.name} ({w.code || 'WHOLESALER'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  New Transit Tamper Seal ID *
                </label>
                <input
                  type="text"
                  value={transferSealId}
                  onChange={(e) => setTransferSealId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={transferLoading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-medium)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading || authorizedWholesalers.length === 0}
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: (transferLoading || authorizedWholesalers.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {transferLoading ? (
                    <>
                      <RefreshCw size={14} className="spin" /> Executing On-Chain Transfer...
                    </>
                  ) : (
                    <>
                      Confirm Transfer <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

