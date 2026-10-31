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
        background: '#ecfdf5',
        border: '1px solid #a7f3d0',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <span style={{
              background: '#d1fae5',
              color: '#047857',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #6ee7b7'
            }}>
              STAGE 3: WHOLESALER
            </span>
            <span style={{ fontSize: '0.72rem', color: '#047857' }}>
              Bulk Stock & Pharmacy Distribution Hub
            </span>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {user?.organizationName || 'Sunset Wholesale'}
          </h2>
          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
            Operator: <strong style={{ color: '#0f172a' }}>{user?.fullName || user?.username}</strong>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#475569',
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
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
            background: activeSubTab === 'incoming' ? '#fef3c7' : '#ffffff',
            border: `1px solid ${activeSubTab === 'incoming' ? '#f59e0b' : '#e2e8f0'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#b45309' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>INCOMING</span>
            <Truck size={14} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {totalIncoming}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
            Awaiting Verification
          </div>
        </div>

        <div 
          onClick={() => setActiveSubTab('inventory')}
          style={{
            background: activeSubTab === 'inventory' ? '#d1fae5' : '#ffffff',
            border: `1px solid ${activeSubTab === 'inventory' ? '#10b981' : '#e2e8f0'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#047857' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>INVENTORY</span>
            <Boxes size={14} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {verifiedInventoryCount}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
            Verified In Custody
          </div>
        </div>

        <div 
          onClick={() => setActiveSubTab('history')}
          style={{
            background: activeSubTab === 'history' ? '#e0f2fe' : '#ffffff',
            border: `1px solid ${activeSubTab === 'history' ? '#0284c7' : '#e2e8f0'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#0369a1' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>TO PHARMACY</span>
            <Store size={14} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {outgoingCount}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
            Dispatched Batches
          </div>
        </div>
      </div>

      {/* Subtab Toggle Buttons */}
      <div style={{
        display: 'flex',
        background: '#f1f5f9',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        border: '1px solid #e2e8f0'
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
            background: activeSubTab === 'incoming' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'incoming' ? '#b45309' : '#64748b',
            boxShadow: activeSubTab === 'incoming' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
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
            background: activeSubTab === 'inventory' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'inventory' ? '#047857' : '#64748b',
            boxShadow: activeSubTab === 'inventory' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
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
            background: activeSubTab === 'history' ? '#ffffff' : 'transparent',
            color: activeSubTab === 'history' ? '#0369a1' : '#64748b',
            boxShadow: activeSubTab === 'history' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
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
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 'var(--radius-md)',
        padding: '8px 12px',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.04)'
      }}>
        <Search size={15} color="#64748b" />
        <input
          type="text"
          placeholder="Search by Batch ID or Medicine name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#0f172a',
            fontSize: '0.8rem',
            width: '100%',
            outline: 'none'
          }}
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')} 
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Batch Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredList.length === 0 ? (
          <div style={{
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: 'var(--radius-lg)',
            padding: '2.5rem 1rem',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <Package size={32} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
              No {activeSubTab === 'incoming' ? 'Incoming Deliveries' : activeSubTab === 'inventory' ? 'Wholesale Inventory' : 'Dispatched Batches'} Found
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
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
                  background: '#ffffff',
                  border: isHold ? '1px solid #fca5a5' : (isIncoming ? '1px solid #fde68a' : '1px solid #e2e8f0'),
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
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
                      color: '#0284c7'
                    }}>
                      {batch.batchId}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      • {batch.quantity ? `${batch.quantity} units` : ''}
                    </span>
                  </div>

                  {isHold ? (
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: '#fef2f2',
                      color: '#dc2626',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid #fecaca'
                    }}>
                      REGULATORY HOLD
                    </span>
                  ) : isIncoming ? (
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: '#fef3c7',
                      color: '#b45309',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid #fde68a',
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
                      background: '#ecfdf5',
                      color: '#047857',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid #a7f3d0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCircle2 size={11} /> IN WHOLESALE CUSTODY
                    </span>
                  )}
                </div>

                {/* Medicine Name & Formulation */}
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                  {batch.medicineName}
                </div>

                {/* Sender & Baseline Info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.72rem',
                  color: '#475569',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '0.5rem'
                }}>
                  <div>
                    <span style={{ color: '#64748b' }}>From: </span>
                    <strong style={{ color: '#0f172a' }}>
                      {batch.transferHistory?.length > 0
                        ? batch.transferHistory[batch.transferHistory.length - 1].senderOrgName
                        : batch.manufacturerName}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: '#64748b' }}>Exp: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#0f172a', fontWeight: 600 }}>{batch.expiryDate || 'N/A'}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '0.25rem' }}>
                  {isIncoming && !isHold && (
                    <button
                      onClick={(e) => openScanModal(batch, e)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
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
                        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
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
                        background: 'linear-gradient(135deg, #059669, #047857)',
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
                        boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
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
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            borderRadius: '24px 24px 0 0',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 800 }}>
                  STAGE 3: WHOLESALER VERIFICATION
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Scan Medicine Package
                </h3>
              </div>
              <button
                onClick={() => setIsScanModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Batch Info Pill */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem'
            }}>
              <div>
                <div style={{ color: '#64748b' }}>Target Batch:</div>
                <div style={{ fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                  {batchToVerify.batchId}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b' }}>Medicine:</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {batchToVerify.medicineName}
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {scanError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#dc2626',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}>
                <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{scanError}</span>
              </div>
            )}

            {/* Image Upload Area */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', display: 'block' }}>
                Capture or Upload Physical Medicine Box / Blister Photo:
              </label>

              <div style={{
                border: '2px dashed #cbd5e1',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                textAlign: 'center',
                background: '#f8fafc',
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
                        color: '#0284c7',
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
                    <Camera size={32} color="#0284c7" style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                      Take photo or upload package image
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                      AI Vision will extract composition, batch number & MRP to verify against Manufacturer baseline
                    </div>
                    <label
                      htmlFor="wh-package-img-upload"
                      style={{
                        display: 'inline-block',
                        marginTop: '0.75rem',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid #bfdbfe'
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
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
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
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
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
                  background: scanResult.verified ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${scanResult.verified ? '#a7f3d0' : '#fecaca'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {scanResult.verified ? (
                    <ShieldCheck size={26} color="#059669" style={{ flexShrink: 0 }} />
                  ) : (
                    <ShieldAlert size={26} color="#dc2626" style={{ flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      color: scanResult.verified ? '#047857' : '#dc2626'
                    }}>
                      {scanResult.verified ? 'VERIFIED AT WHOLESALER' : 'VERIFICATION FAILED'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                      {scanResult.verified 
                        ? 'Medicine packaging directly matches the original Manufacturer baseline and cryptographic hash.'
                        : `Discrepancy detected on: ${scanResult.failedFields?.join(', ') || 'Package fields'}`}
                    </div>
                  </div>
                </div>

                {/* Field-by-Field Baseline Comparison */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} color="#0284c7" /> Field-Level Baseline Comparison
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(scanResult.fieldChecks || {}).map(([key, f]) => (
                      <div 
                        key={key} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderBottom: '1px solid #e2e8f0'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{f.field}</div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            Expected: {String(f.expected)}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: f.match ? '#ecfdf5' : '#fef2f2',
                            color: f.match ? '#047857' : '#dc2626',
                            border: `1px solid ${f.match ? '#a7f3d0' : '#fecaca'}`
                          }}>
                            {f.status}
                          </span>
                          <div style={{ fontSize: '0.68rem', color: '#334155', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(f.extracted)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cryptographic Hash Audit */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={12} /> Cryptographic Integrity Audit
                    </span>
                    <span style={{ color: scanResult.hashMatch ? '#047857' : '#dc2626', fontWeight: 800 }}>
                      {scanResult.hashMatch ? '✓ HASH MATCH' : '✗ HASH MISMATCH'}
                    </span>
                  </div>
                  <div style={{ wordBreak: 'break-all', color: '#7c3aed' }}>
                    Trusted Hash: {scanResult.trustedDataHash}
                  </div>
                  <div style={{ wordBreak: 'break-all', color: '#0284c7', marginTop: '2px' }}>
                    Scanned Hash: {scanResult.scannedDataHash}
                  </div>
                </div>

                {/* Accept Custody Action */}
                {scanResult.verified && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                        New Wholesaler Storage Security Seal ID:
                      </label>
                      <input 
                        type="text"
                        value={newSealId}
                        onChange={(e) => setNewSealId(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          padding: '8px',
                          borderRadius: 'var(--radius-sm)',
                          color: '#0f172a',
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
                        background: 'linear-gradient(135deg, #059669, #047857)',
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
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
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
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            borderRadius: '24px 24px 0 0',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 800 }}>
                  STAGE 3 ➔ STAGE 4 CUSTODY DISPATCH
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Transfer to Pharmacy / Retailer
                </h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Transfer Details Card */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Batch ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#0284c7' }}>
                  {batchToTransfer.batchId}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Medicine:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{batchToTransfer.medicineName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Quantity:</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{batchToTransfer.quantity} units</span>
              </div>
            </div>

            {/* Error / Success Feedback */}
            {transferError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#dc2626',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} color="#dc2626" />
                <span>{transferError}</span>
              </div>
            )}

            {transferSuccess && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                color: '#047857',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} color="#059669" />
                <span>{transferSuccess}</span>
              </div>
            )}

            {/* Target Retailer Select */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px', display: 'block' }}>
                Authorized Target Pharmacy / Retailer *
              </label>
              {loadingRules ? (
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Loading authorized retailers...</div>
              ) : (
                <select
                  value={selectedReceiverId}
                  onChange={(e) => setSelectedReceiverId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    colorScheme: 'light',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                >
                  <option value="" style={{ background: '#ffffff', color: '#64748b' }}>-- Select Target Retailer --</option>
                  {authorizedRetailers.map(r => (
                    <option key={r._id || r.id} value={r._id || r.id} style={{ background: '#ffffff', color: '#0f172a' }}>
                      {r.name} ({r.code || 'RETAIL'}) - {r.address || 'Licensed Retailer'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* New Transit Security Seal ID */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px', display: 'block' }}>
                Transit Tamper-Evident Security Seal ID *
              </label>
              <input
                type="text"
                value={transferSealId}
                onChange={(e) => setTransferSealId(e.target.value)}
                placeholder="e.g. SEAL-TR-4910"
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
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
                  ? 'linear-gradient(135deg, #059669, #047857)'
                  : '#f1f5f9',
                color: selectedReceiverId ? '#fff' : '#94a3b8',
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
                marginTop: '0.5rem',
                boxShadow: selectedReceiverId ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none'
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
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            borderRadius: '24px 24px 0 0',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 800 }}>
                  END-TO-END TRACEABILITY AUDIT
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {selectedBatch.batchId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.78rem'
            }}>
              <div><span style={{ color: '#64748b' }}>Medicine:</span> <strong style={{ color: '#0f172a' }}>{selectedBatch.medicineName}</strong></div>
              <div><span style={{ color: '#64748b' }}>Manufacturer:</span> <strong style={{ color: '#0f172a' }}>{selectedBatch.manufacturerName}</strong></div>
              <div><span style={{ color: '#64748b' }}>Current Custody Holder:</span> <strong style={{ color: '#0284c7' }}>{selectedBatch.currentHolderName}</strong></div>
              <div><span style={{ color: '#64748b' }}>Current Stage:</span> <span style={{ color: '#059669', fontWeight: 700 }}>Stage 3 (Wholesaler)</span></div>
              <div><span style={{ color: '#64748b' }}>Active Status:</span> <strong style={{ color: '#0f172a' }}>{selectedBatch.status}</strong></div>
              <div><span style={{ color: '#64748b' }}>Quantity:</span> <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedBatch.quantity} units</span></div>
              <div><span style={{ color: '#64748b' }}>Current Security Seal:</span> <span style={{ fontFamily: 'var(--font-mono)', color: '#d97706', fontWeight: 700 }}>{selectedBatch.sealId}</span></div>
            </div>

            {/* Cryptographic Baseline Audit */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)'
            }}>
              <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: '6px' }}>
                Manufacturer Cryptographic Baseline
              </div>
              <div style={{ wordBreak: 'break-all', color: '#475569' }}>
                Trusted Hash: {selectedBatch.trustedDataHash}
              </div>
              <div style={{ marginTop: '4px', color: '#059669' }}>
                Fingerprint: {selectedBatch.batchFingerprint}
              </div>
            </div>

            {/* Custody Transfer History */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                Custody Chain Transitions ({selectedBatch.transferHistory?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(selectedBatch.transferHistory || []).map((t, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px',
                      fontSize: '0.72rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#0284c7' }}>{t.senderOrgName}</strong> ➔ <strong style={{ color: '#059669' }}>{t.receiverOrgName}</strong>
                      <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                        Seal: {t.newSealId}
                      </div>
                    </div>
                    {t.blockNumber && (
                      <span style={{ color: '#059669', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600 }}>
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

