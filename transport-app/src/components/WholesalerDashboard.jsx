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
  ShieldAlert,
  Store
} from 'lucide-react';
import { api } from '../services/api';

export default function WholesalerDashboard({ 
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

  // Transfer to Retailer / Pharmacy Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [batchToTransfer, setBatchToTransfer] = useState(null);
  const [authorizedRetailers, setAuthorizedRetailers] = useState([]);
  const [allRetailers, setAllRetailers] = useState([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState('');
  const [transferSealId, setTransferSealId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [loadingRules, setLoadingRules] = useState(false);

  const myOrgId = String(user?.organizationId || '');

  // Filter batches for this Wholesaler
  // 1. Incoming Deliveries: batches addressed to this Wholesaler from Distributor that are In Transit
  const incomingDeliveries = (batches || []).filter(b => 
    String(b.currentHolderId) === myOrgId && b.status === 'In Transit'
  );

  // 2. Verified Inventory: batches held by this Wholesaler that are in custody
  const inventoryBatches = (batches || []).filter(b => 
    String(b.currentHolderId) === myOrgId && b.status !== 'In Transit'
  );

  // 3. Outgoing Transfers: batches transferred onward to Retailers
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
    setNewSealId(`SEAL-WHOLE-${Math.floor(1000 + Math.random() * 9000)}`);
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

      // 2. Call backend to verify extracted fields directly against original Manufacturer baseline
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
      showToast(`Batch ${batchToVerify.batchId} accepted into Wholesaler inventory successfully!`, 'success');
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

  // Open Transfer to Retailer / Pharmacy Modal
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
      // Fetch active organizations of type Retailer
      const orgsRes = await api.getOrganizations({ status: 'Active' });
      const orgList = orgsRes.organizations || [];
      const retailers = orgList.filter(o => o.type === 'Retailer' || o.type?.toLowerCase().includes('retail') || o.type?.toLowerCase().includes('pharmacy'));
      setAllRetailers(retailers);

      // Check configured rules
      try {
        const rulesRes = await api.getSupplyChainRules();
        const ruleDoc = rulesRes.rules || {};
        const allowedTransitions = ruleDoc.allowedTransitions || [];
        
        const myTransitions = allowedTransitions.filter(t => 
          t.from === 'Wholesaler' || t.fromOrg === user?.organizationName
        );

        if (myTransitions.length > 0) {
          const authList = retailers.filter(w => 
            myTransitions.some(t => t.toOrg === w.name || t.to === 'Retailer')
          );
          setAuthorizedRetailers(authList.length > 0 ? authList : retailers);
        } else {
          setAuthorizedRetailers(retailers);
        }
      } catch (rErr) {
        setAuthorizedRetailers(retailers);
      }
    } catch (err) {
      setTransferError('Could not load authorized retailers. Please check connection.');
    } finally {
      setLoadingRules(false);
    }
  };

  // Execute Custody Transfer to Retailer
  const handleExecuteTransfer = async () => {
    if (!selectedReceiverId) {
      setTransferError('Please select a target authorized Retailer / Pharmacy.');
      return;
    }
    if (!transferSealId.trim()) {
      setTransferError('A new tamper-evident security seal ID is required.');
      return;
    }

    setTransferLoading(true);
    setTransferError('');

    try {
      const res = await api.transferBatch(batchToTransfer.batchId, {
        receiverOrgId: selectedReceiverId,
        newSealId: transferSealId.trim()
      });

      setTransferSuccess(`Custody of batch ${batchToTransfer.batchId} transferred successfully to Retailer!`);
      showToast(`Batch ${batchToTransfer.batchId} dispatched to Retailer!`, 'success');
      if (onRefresh) onRefresh();

      setTimeout(() => {
        setIsTransferModalOpen(false);
        setActiveSubTab('history');
      }, 1800);
    } catch (err) {
      setTransferError(err.message || 'Transfer failed. Ensure recipient is authorized.');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="animate-slide">
      {/* Header Profile Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.08))',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <span style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(16, 185, 129, 0.4)'
            }}>
              STAGE 3: WHOLESALER
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Bulk Stock & Pharmacy Distribution Hub
            </span>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            {user?.organizationName || 'Sunset Wholesale'}
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Operator: <strong style={{ color: '#fff' }}>{user?.fullName || user?.username}</strong>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-secondary)',
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Refresh Data"
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.75rem'
      }}>
        <div 
          onClick={() => setActiveSubTab('incoming')}
          style={{
            background: activeSubTab === 'incoming' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
            border: `1px solid ${activeSubTab === 'incoming' ? '#f59e0b' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#f59e0b' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>INCOMING</span>
            <Truck size={14} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {totalIncoming}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Awaiting Verification
          </div>
        </div>

        <div 
          onClick={() => setActiveSubTab('inventory')}
          style={{
            background: activeSubTab === 'inventory' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
            border: `1px solid ${activeSubTab === 'inventory' ? '#10b981' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10b981' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>INVENTORY</span>
            <Boxes size={14} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {verifiedInventoryCount}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Verified In Custody
          </div>
        </div>

        <div 
          onClick={() => setActiveSubTab('history')}
          style={{
            background: activeSubTab === 'history' ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-card)',
            border: `1px solid ${activeSubTab === 'history' ? '#06b6d4' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#06b6d4' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>TO PHARMACY</span>
            <Store size={14} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {outgoingCount}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Dispatched Batches
          </div>
        </div>
      </div>

      {/* Subtab Toggle Buttons */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        border: '1px solid var(--border-medium)'
      }}>
        <button
          onClick={() => setActiveSubTab('incoming')}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: activeSubTab === 'incoming' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            color: activeSubTab === 'incoming' ? '#fbbf24' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          Incoming Deliveries ({totalIncoming})
        </button>

        <button
          onClick={() => setActiveSubTab('inventory')}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: activeSubTab === 'inventory' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            color: activeSubTab === 'inventory' ? '#34d399' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          Wholesale Stock ({verifiedInventoryCount})
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: activeSubTab === 'history' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            color: activeSubTab === 'history' ? '#38bdf8' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          Dispatched ({outgoingCount})
        </button>
      </div>

      {/* Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 12px'
      }}>
        <Search size={15} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search by Batch ID or Medicine name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '0.8rem',
            width: '100%',
            outline: 'none'
          }}
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Batch Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredList.length === 0 ? (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px dashed var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '2.5rem 1rem',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}>
            <Package size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
              No {activeSubTab === 'incoming' ? 'Incoming Deliveries' : activeSubTab === 'inventory' ? 'Wholesale Inventory' : 'Dispatched Batches'} Found
            </div>
            <div style={{ fontSize: '0.72rem', marginTop: '4px' }}>
              {activeSubTab === 'incoming' 
                ? 'Deliveries dispatched to you by authorized Distributors will appear here.'
                : activeSubTab === 'inventory'
                  ? 'Verify incoming medicine packages to accept custody into wholesale inventory.'
                  : 'Batches transferred onward to Pharmacies will be recorded here.'}
            </div>
          </div>
        ) : (
          filteredList.map((batch) => {
            const isIncoming = batch.status === 'In Transit' && String(batch.currentHolderId) === myOrgId;
            const isHold = batch.status === 'Blocked';

            return (
              <div
                key={batch.batchId}
                onClick={() => setSelectedBatch(batch)}
                style={{
                  background: 'var(--bg-card)',
                  border: isHold ? '1px solid rgba(239, 68, 68, 0.5)' : (isIncoming ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-medium)'),
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'transform 0.15s, border-color 0.15s'
                }}
              >
                {/* Top Row: Batch ID and Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      color: '#38bdf8'
                    }}>
                      {batch.batchId}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      • {batch.quantity ? `${batch.quantity} units` : ''}
                    </span>
                  </div>

                  {isHold ? (
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(239, 68, 68, 0.4)'
                    }}>
                      REGULATORY HOLD
                    </span>
                  ) : isIncoming ? (
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Truck size={11} /> INCOMING DELIVERY
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle2 size={11} /> IN WHOLESALE CUSTODY
                    </span>
                  )}
                </div>

                {/* Medicine Name & Formulation */}
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                  {batch.medicineName}
                </div>

                {/* Sender & Baseline Info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.5rem'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>From: </span>
                    <strong style={{ color: '#fff' }}>
                      {batch.transferHistory?.length > 0
                        ? batch.transferHistory[batch.transferHistory.length - 1].senderOrgName
                        : batch.manufacturerName}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Exp: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{batch.expiryDate || 'N/A'}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '0.25rem' }}>
                  {isIncoming && !isHold && (
                    <button
                      onClick={(e) => openScanModal(batch, e)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(6, 182, 212, 0.25)'
                      }}
                    >
                      <Camera size={14} /> Scan & Verify Package
                    </button>
                  )}

                  {!isIncoming && !isHold && activeSubTab === 'inventory' && (
                    <button
                      onClick={(e) => openTransferModal(batch, e)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Store size={14} /> Dispatch to Pharmacy
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SCAN & VERIFY MEDICINE PACKAGE MODAL */}
      {isScanModalOpen && batchToVerify && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-medium)',
            borderRadius: '24px 24px 0 0',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: 'slideUp 0.3s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 800 }}>
                  STAGE 3: WHOLESALER VERIFICATION
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Scan Medicine Package
                </h3>
              </div>
              <button
                onClick={() => setIsScanModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Batch Info Pill */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem'
            }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Target Batch:</div>
                <div style={{ fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                  {batchToVerify.batchId}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Medicine:</div>
                <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                  {batchToVerify.medicineName}
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {scanError && (
              <div style={{
                background: 'var(--rose-bg)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#fca5a5',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}>
                <AlertCircle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{scanError}</span>
              </div>
            )}

            {/* Image Upload Area */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                Capture or Upload Physical Medicine Box / Blister Photo:
              </label>

              <div style={{
                border: '2px dashed var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                textAlign: 'center',
                background: 'var(--bg-surface)',
                position: 'relative'
              }}>
                {imagePreview ? (
                  <div style={{ position: 'relative' }}>
                    <img 
                      src={imagePreview} 
                      alt="Medicine Package Scan" 
                      style={{ maxHeight: '180px', borderRadius: 'var(--radius-md)', margin: '0 auto', display: 'block' }}
                    />
                    <label 
                      htmlFor="wh-package-img-reupload" 
                      style={{
                        display: 'inline-block',
                        marginTop: '0.75rem',
                        fontSize: '0.72rem',
                        color: '#38bdf8',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Change Photo
                    </label>
                    <input 
                      id="wh-package-img-reupload" 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageSelect} 
                      style={{ display: 'none' }} 
                    />
                  </div>
                ) : (
                  <div>
                    <Camera size={32} color="#06b6d4" style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                      Take photo or upload package image
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      AI Vision will extract composition, batch number & MRP to verify against Manufacturer baseline
                    </div>
                    <label
                      htmlFor="wh-package-img-upload"
                      style={{
                        display: 'inline-block',
                        marginTop: '0.75rem',
                        background: 'rgba(6, 182, 212, 0.15)',
                        color: '#38bdf8',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid rgba(6, 182, 212, 0.4)'
                      }}
                    >
                      Select Image
                    </label>
                    <input 
                      id="wh-package-img-upload" 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageSelect} 
                      style={{ display: 'none' }} 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Execute AI Scan Button */}
            {imageFile && !scanResult && (
              <button
                onClick={handleExecuteScanVerification}
                disabled={isScanning}
                style={{
                  background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Extracting & Verifying with Groq Vision...
                  </>
                ) : (
                  <>
                    <FileCheck2 size={16} />
                    Run AI Verification vs Original Baseline
                  </>
                )}
              </button>
            )}

            {/* Scan Results Display */}
            {scanResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Overall Verdict Banner */}
                <div style={{
                  background: scanResult.verified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  border: `1px solid ${scanResult.verified ? 'rgba(16, 185, 129, 0.5)' : 'rgba(244, 63, 94, 0.5)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {scanResult.verified ? (
                    <ShieldCheck size={26} color="#10b981" style={{ flexShrink: 0 }} />
                  ) : (
                    <ShieldAlert size={26} color="#f43f5e" style={{ flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      color: scanResult.verified ? '#10b981' : '#f43f5e'
                    }}>
                      {scanResult.verified ? 'VERIFIED AT WHOLESALER' : 'VERIFICATION FAILED'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {scanResult.verified 
                        ? 'Medicine packaging directly matches the original Manufacturer baseline and cryptographic hash.'
                        : `Discrepancy detected on: ${scanResult.failedFields?.join(', ') || 'Package fields'}`}
                    </div>
                  </div>
                </div>

                {/* Field-by-Field Baseline Comparison */}
                <div style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} color="#38bdf8" /> Field-Level Baseline Comparison
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(scanResult.fieldChecks || {}).map(([key, f]) => (
                      <div 
                        key={key} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 6px',
                          borderBottom: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{f.field}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Expected: {String(f.expected)}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: f.match ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                            color: f.match ? '#10b981' : '#f43f5e'
                          }}>
                            {f.status}
                          </span>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(f.extracted)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cryptographic Hash Audit */}
                <div style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={12} /> Cryptographic Integrity Audit
                    </span>
                    <span style={{ color: scanResult.hashMatch ? '#10b981' : '#f43f5e', fontWeight: 800 }}>
                      {scanResult.hashMatch ? '✓ HASH MATCH' : '✗ HASH MISMATCH'}
                    </span>
                  </div>
                  <div style={{ wordBreak: 'break-all', color: '#c084fc' }}>
                    Trusted Hash: {scanResult.trustedDataHash}
                  </div>
                  <div style={{ wordBreak: 'break-all', color: '#38bdf8', marginTop: '2px' }}>
                    Scanned Hash: {scanResult.scannedDataHash}
                  </div>
                </div>

                {/* Accept Custody Action */}
                {scanResult.verified && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        New Wholesaler Storage Security Seal ID:
                      </label>
                      <input 
                        type="text"
                        value={newSealId}
                        onChange={(e) => setNewSealId(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-medium)',
                          padding: '8px',
                          borderRadius: 'var(--radius-sm)',
                          color: '#fff',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.78rem',
                          marginTop: '2px'
                        }}
                      />
                    </div>

                    <button
                      onClick={handleConfirmReceipt}
                      disabled={receiving}
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#fff',
                        border: 'none',
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      {receiving ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          Recording On-Chain Receipt Event...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} />
                          Accept & Confirm Custody at Wholesaler
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

      {/* DISPATCH TO RETAILER / PHARMACY MODAL */}
      {isTransferModalOpen && batchToTransfer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-medium)',
            borderRadius: '24px 24px 0 0',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: 'slideUp 0.3s ease-out'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800 }}>
                  STAGE 3 ➔ STAGE 4 CUSTODY DISPATCH
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Transfer to Pharmacy / Retailer
                </h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Transfer Details Card */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Batch ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#fff' }}>
                  {batchToTransfer.batchId}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Medicine:</span>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>{batchToTransfer.medicineName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Quantity:</span>
                <span style={{ color: '#fff' }}>{batchToTransfer.quantity} units</span>
              </div>
            </div>

            {/* Error / Success Feedback */}
            {transferError && (
              <div style={{
                background: 'var(--rose-bg)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#fca5a5',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} color="#f43f5e" />
                <span>{transferError}</span>
              </div>
            )}

            {transferSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#34d399',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>{transferSuccess}</span>
              </div>
            )}

            {/* Target Retailer Select */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                Authorized Target Pharmacy / Retailer *
              </label>
              {loadingRules ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading authorized retailers...</div>
              ) : (
                <select
                  value={selectedReceiverId}
                  onChange={(e) => setSelectedReceiverId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0d1526',
                    border: '1px solid var(--border-medium)',
                    color: '#fff',
                    colorScheme: 'dark',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                >
                  <option value="" style={{ background: '#0f172a', color: '#94a3b8' }}>-- Select Target Retailer --</option>
                  {authorizedRetailers.map(r => (
                    <option key={r._id || r.id} value={r._id || r.id} style={{ background: '#0f172a', color: '#ffffff' }}>
                      {r.name} ({r.code || 'RETAIL'}) - {r.address || 'Licensed Retailer'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* New Transit Security Seal ID */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                Transit Tamper-Evident Security Seal ID *
              </label>
              <input
                type="text"
                value={transferSealId}
                onChange={(e) => setTransferSealId(e.target.value)}
                placeholder="e.g. SEAL-TR-4910"
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem'
                }}
              />
            </div>

            {/* Dispatch Action Button */}
            <button
              onClick={handleExecuteTransfer}
              disabled={transferLoading || !selectedReceiverId}
              style={{
                background: selectedReceiverId 
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'var(--bg-surface)',
                color: selectedReceiverId ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: selectedReceiverId ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '0.5rem'
              }}
            >
              {transferLoading ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  Signing Blockchain Transfer...
                </>
              ) : (
                <>
                  <Truck size={16} />
                  Authorize & Dispatch to Pharmacy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* BATCH DETAILS DRAWER */}
      {selectedBatch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-medium)',
            borderRadius: '24px 24px 0 0',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 800 }}>
                  END-TO-END TRACEABILITY AUDIT
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {selectedBatch.batchId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.78rem'
            }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Medicine:</span> <strong style={{ color: '#fff' }}>{selectedBatch.medicineName}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Manufacturer:</span> <strong style={{ color: '#fff' }}>{selectedBatch.manufacturerName}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Current Custody Holder:</span> <strong style={{ color: '#38bdf8' }}>{selectedBatch.currentHolderName}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Current Stage:</span> <span style={{ color: '#10b981', fontWeight: 700 }}>Stage 3 (Wholesaler)</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Active Status:</span> <strong style={{ color: '#fff' }}>{selectedBatch.status}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Quantity:</span> <span style={{ color: '#fff' }}>{selectedBatch.quantity} units</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Current Security Seal:</span> <span style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>{selectedBatch.sealId}</span></div>
            </div>

            {/* Cryptographic Baseline Audit */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)'
            }}>
              <div style={{ fontWeight: 700, color: '#c084fc', marginBottom: '6px' }}>
                Manufacturer Cryptographic Baseline
              </div>
              <div style={{ wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
                Trusted Hash: {selectedBatch.trustedDataHash}
              </div>
              <div style={{ marginTop: '4px', color: '#10b981' }}>
                Fingerprint: {selectedBatch.batchFingerprint}
              </div>
            </div>

            {/* Custody Transfer History */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                Custody Chain Transitions ({selectedBatch.transferHistory?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(selectedBatch.transferHistory || []).map((t, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px',
                      fontSize: '0.72rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#38bdf8' }}>{t.senderOrgName}</strong> ➔ <strong style={{ color: '#10b981' }}>{t.receiverOrgName}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                        Seal: {t.newSealId}
                      </div>
                    </div>
                    {t.blockNumber && (
                      <span style={{ color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                        Block #{t.blockNumber}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

