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
  Store,
  Pill,
  UserCheck,
  ClipboardList
} from 'lucide-react';
import { api } from '../services/api';

export default function RetailerDashboard({ 
  user, 
  batches = [], 
  onRefresh, 
  loading = false,
  showToast = () => {}
}) {
  const [activeSubTab, setActiveSubTab] = useState('incoming'); // 'incoming', 'stock', 'dispensed'
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

  // Dispense to Patient Modal State
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [batchToDispense, setBatchToDispense] = useState(null);
  const [patientId, setPatientId] = useState('');
  const [dispenseQty, setDispenseQty] = useState(1);
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [dispensing, setDispensing] = useState(false);
  const [dispenseError, setDispenseError] = useState('');
  const [dispenseSuccess, setDispenseSuccess] = useState('');

  const myOrgId = String(user?.organizationId || '');

  // Filter batches for this Pharmacy / Retailer
  // 1. Incoming Deliveries: batches addressed to this Pharmacy from Wholesaler that are In Transit
  const incomingDeliveries = (batches || []).filter(b => 
    String(b.currentHolderId) === myOrgId && b.status === 'In Transit'
  );

  // 2. Active Pharmacy Stock: batches held by this Pharmacy in custody
  const stockBatches = (batches || []).filter(b => 
    String(b.currentHolderId) === myOrgId && b.status !== 'In Transit' && b.status !== 'Dispensed'
  );

  // 3. Dispensed Batches: batches with dispenseHistory or status == Dispensed
  const dispensedBatches = (batches || []).filter(b => 
    String(b.currentHolderId) === myOrgId && (b.status === 'Dispensed' || (b.dispenseHistory && b.dispenseHistory.length > 0))
  );

  // KPI Metrics calculation
  const totalIncoming = incomingDeliveries.length;
  const inStockCount = stockBatches.length;
  const dispensedCount = dispensedBatches.length;

  // Search filtering
  const currentList = activeSubTab === 'incoming' 
    ? incomingDeliveries 
    : activeSubTab === 'stock' 
      ? stockBatches 
      : dispensedBatches;

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
    setNewSealId(`SEAL-PHARM-${Math.floor(1000 + Math.random() * 9000)}`);
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
      showToast(`Batch ${batchToVerify.batchId} accepted into Pharmacy stock successfully!`, 'success');
      if (onRefresh) onRefresh();
      setTimeout(() => {
        setIsScanModalOpen(false);
        setActiveSubTab('stock');
      }, 1600);
    } catch (err) {
      setScanError(err.message || 'Receipt confirmation failed. Please try again.');
    } finally {
      setReceiving(false);
    }
  };

  // Open Dispense to Patient Modal
  const openDispenseModal = (batch, e) => {
    if (e) e.stopPropagation();
    setBatchToDispense(batch);
    setPatientId(`PAT-${Math.floor(100000 + Math.random() * 900000)}`);
    setDispenseQty(1);
    setDispenseNotes('Verified against doctor prescription. Packaging integrity confirmed.');
    setDispenseError('');
    setDispenseSuccess('');
    setIsDispenseModalOpen(true);
  };

  // Execute Dispense to Patient
  const handleExecuteDispense = async () => {
    if (!patientId.trim()) {
      setDispenseError('Patient / Prescription ID is required.');
      return;
    }
    if (dispenseQty <= 0) {
      setDispenseError('Dispensed quantity must be greater than zero.');
      return;
    }
    if (dispenseQty > (batchToDispense.quantity || 1)) {
      setDispenseError(`Cannot dispense ${dispenseQty} units. Only ${batchToDispense.quantity} units available.`);
      return;
    }

    setDispensing(true);
    setDispenseError('');

    try {
      const res = await api.dispenseBatch(batchToDispense.batchId, {
        patientId: patientId.trim(),
        dispensedQuantity: parseInt(dispenseQty),
        notes: dispenseNotes.trim()
      });

      setDispenseSuccess(`Successfully dispensed ${dispenseQty} units of ${batchToDispense.medicineName} to patient!`);
      showToast(`Medicine dispensed to patient ${patientId}!`, 'success');
      if (onRefresh) onRefresh();

      setTimeout(() => {
        setIsDispenseModalOpen(false);
        setActiveSubTab('dispensed');
      }, 1800);
    } catch (err) {
      setDispenseError(err.message || 'Dispensing failed. Check batch availability.');
    } finally {
      setDispensing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="animate-slide">
      {/* Header Profile Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(16, 185, 129, 0.08))',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <span style={{
              background: 'rgba(6, 182, 212, 0.2)',
              color: '#38bdf8',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(6, 182, 212, 0.4)'
            }}>
              STAGE 4: PHARMACY / RETAILER
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Final Dispensing & Patient Safety Custody
            </span>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            {user?.organizationName || 'HealthPlus Pharmacy'}
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Pharmacist: <strong style={{ color: '#fff' }}>{user?.fullName || user?.username}</strong>
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
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>DELIVERIES</span>
            <Truck size={14} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {totalIncoming}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            From Wholesalers
          </div>
        </div>

        <div 
          onClick={() => setActiveSubTab('stock')}
          style={{
            background: activeSubTab === 'stock' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
            border: `1px solid ${activeSubTab === 'stock' ? '#10b981' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10b981' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>ACTIVE STOCK</span>
            <Boxes size={14} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {inStockCount}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Ready to Dispense
          </div>
        </div>

        <div 
          onClick={() => setActiveSubTab('dispensed')}
          style={{
            background: activeSubTab === 'dispensed' ? 'rgba(192, 132, 252, 0.15)' : 'var(--bg-card)',
            border: `1px solid ${activeSubTab === 'dispensed' ? '#c084fc' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#c084fc' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>DISPENSED</span>
            <Pill size={14} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {dispensedCount}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Patient Completed
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
          Incoming Shipments ({totalIncoming})
        </button>

        <button
          onClick={() => setActiveSubTab('stock')}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: activeSubTab === 'stock' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            color: activeSubTab === 'stock' ? '#34d399' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          Pharmacy Stock ({inStockCount})
        </button>

        <button
          onClick={() => setActiveSubTab('dispensed')}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: activeSubTab === 'dispensed' ? 'rgba(192, 132, 252, 0.2)' : 'transparent',
            color: activeSubTab === 'dispensed' ? '#c084fc' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          Dispensed ({dispensedCount})
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
            <Store size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
              No {activeSubTab === 'incoming' ? 'Incoming Deliveries' : activeSubTab === 'stock' ? 'Pharmacy Stock' : 'Dispensed Records'} Found
            </div>
            <div style={{ fontSize: '0.72rem', marginTop: '4px' }}>
              {activeSubTab === 'incoming' 
                ? 'Deliveries dispatched from authorized Wholesalers will appear here.'
                : activeSubTab === 'stock'
                  ? 'Scan incoming medicine boxes to verify authenticity and accept into pharmacy stock.'
                  : 'Medicines dispensed to patients will appear here with full provenance logs.'}
            </div>
          </div>
        ) : (
          filteredList.map((batch) => {
            const isIncoming = batch.status === 'In Transit' && String(batch.currentHolderId) === myOrgId;
            const isHold = batch.status === 'Blocked';
            const isDispensed = batch.status === 'Dispensed';

            return (
              <div
                key={batch.batchId}
                onClick={() => setSelectedBatch(batch)}
                style={{
                  background: 'var(--bg-card)',
                  border: isHold ? '1px solid rgba(239, 68, 68, 0.5)' : (isIncoming ? '1px solid rgba(245, 158, 11, 0.4)' : isDispensed ? '1px solid rgba(192, 132, 252, 0.4)' : '1px solid var(--border-medium)'),
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
                      <Truck size={11} /> INCOMING SHIPMENT
                    </span>
                  ) : isDispensed ? (
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: 'rgba(192, 132, 252, 0.2)',
                      color: '#c084fc',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(192, 132, 252, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Pill size={11} /> FULLY DISPENSED
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
                      <CheckCircle2 size={11} /> VERIFIED SHELF STOCK
                    </span>
                  )}
                </div>

                {/* Medicine Name & Formulation */}
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                  {batch.medicineName}
                </div>

                {/* Origin & Expiry Details */}
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

                  {!isIncoming && !isHold && !isDispensed && activeSubTab === 'stock' && (
                    <button
                      onClick={(e) => openDispenseModal(batch, e)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #c084fc, #9333ea)',
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
                        boxShadow: '0 2px 8px rgba(192, 132, 252, 0.25)'
                      }}
                    >
                      <Pill size={14} /> Dispense to Patient
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
                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800 }}>
                  STAGE 4: PHARMACY VERIFICATION
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Pharmacy Counter Package Verification
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
                Capture or Upload Physical Medicine Box / Strip Photo:
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
                      htmlFor="ret-package-img-reupload" 
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
                      id="ret-package-img-reupload" 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageSelect} 
                      style={{ display: 'none' }} 
                    />
                  </div>
                ) : (
                  <div>
                    <Camera size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                      Take photo or upload package image
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Groq Vision will extract printed details and verify directly against the original Manufacturer baseline
                    </div>
                    <label
                      htmlFor="ret-package-img-upload"
                      style={{
                        display: 'inline-block',
                        marginTop: '0.75rem',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      Select Image
                    </label>
                    <input 
                      id="ret-package-img-upload" 
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
                      {scanResult.verified ? 'VERIFIED AT PHARMACY' : 'VERIFICATION FAILED'}
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
                        Pharmacy Shelf Storage Verification Seal:
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
                          Accept & Stock Medicine at Pharmacy
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

      {/* DISPENSE TO PATIENT MODAL */}
      {isDispenseModalOpen && batchToDispense && (
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
                <div style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 800 }}>
                  STAGE 4 FINAL DISPENSING
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Dispense to Patient / Prescription
                </h3>
              </div>
              <button
                onClick={() => setIsDispenseModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Medicine Summary */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Medicine:</span>
                <strong style={{ color: '#38bdf8' }}>{batchToDispense.medicineName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Batch ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{batchToDispense.batchId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Available Stock:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{batchToDispense.quantity} units</span>
              </div>
            </div>

            {/* Error / Success Feedback */}
            {dispenseError && (
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
                <span>{dispenseError}</span>
              </div>
            )}

            {dispenseSuccess && (
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
                <span>{dispenseSuccess}</span>
              </div>
            )}

            {/* Patient ID input */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                Patient ID / Prescription Slip Number *
              </label>
              <input
                type="text"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="e.g. PAT-982104"
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

            {/* Dispense Quantity */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                Quantity to Dispense (Units) *
              </label>
              <input
                type="number"
                min="1"
                max={batchToDispense.quantity || 1}
                value={dispenseQty}
                onChange={(e) => setDispenseQty(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: '#fff',
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem'
                }}
              />
            </div>

            {/* Dispense Notes */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                Pharmacist Verification Notes
              </label>
              <textarea
                rows={2}
                value={dispenseNotes}
                onChange={(e) => setDispenseNotes(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: '#fff',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.78rem',
                  resize: 'none'
                }}
              />
            </div>

            {/* Dispense Action Button */}
            <button
              onClick={handleExecuteDispense}
              disabled={dispensing}
              style={{
                background: 'linear-gradient(135deg, #c084fc, #9333ea)',
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
                marginTop: '0.5rem',
                boxShadow: '0 4px 15px rgba(192, 132, 252, 0.3)'
              }}
            >
              {dispensing ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  Recording On-Chain Dispense Event...
                </>
              ) : (
                <>
                  <UserCheck size={16} />
                  Confirm Dispensing to Patient
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
                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800 }}>
                  PHARMACY DISPENSING RECORD
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
              <div><span style={{ color: 'var(--text-muted)' }}>Current Stage:</span> <span style={{ color: '#c084fc', fontWeight: 700 }}>Stage 4 (Pharmacy / Retailer)</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Active Status:</span> <strong style={{ color: '#fff' }}>{selectedBatch.status}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Remaining Quantity:</span> <span style={{ color: '#fff' }}>{selectedBatch.quantity} units</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Pharmacy Seal ID:</span> <span style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24' }}>{selectedBatch.sealId}</span></div>
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

            {/* Dispense Logs */}
            {selectedBatch.dispenseHistory && selectedBatch.dispenseHistory.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ClipboardList size={14} /> Patient Dispensing Records ({selectedBatch.dispenseHistory.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedBatch.dispenseHistory.map((d, dIdx) => (
                    <div
                      key={dIdx}
                      style={{
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 10px',
                        fontSize: '0.72rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#fff', fontWeight: 700 }}>Patient: {d.patientId}</span>
                        <span style={{ color: '#10b981' }}>{d.dispensedQuantity} units</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                        Notes: {d.notes}
                      </div>
                      {d.blockNumber && (
                        <div style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                          Blockchain Block #{d.blockNumber}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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

