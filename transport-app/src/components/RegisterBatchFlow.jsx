import React, { useState } from 'react';
import { 
  PackagePlus, 
  Camera, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  Cpu, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  AlertTriangle,
  Layers,
  Sparkles,
  FileCheck,
  Check,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function RegisterBatchFlow({ 
  user, 
  onSuccess, 
  onCancel,
  showToast 
}) {
  const [step, setStep] = useState(1); // 1: Input Data, 2: Image & AI Scan, 3: Verification & Baseline, 4: Blockchain Receipt

  // Step 1: Form Inputs
  const [medicineName, setMedicineName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [composition, setComposition] = useState('');
  const [quantity, setQuantity] = useState('');
  const [mrp, setMrp] = useState('');
  const [sealId, setSealId] = useState('');

  // Step 2: Image & Extraction
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiExtracted, setAiExtracted] = useState(null);

  // Step 3: Verification Result & Baseline
  const [verificationResult, setVerificationResult] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState('');

  // Step 4: Receipt
  const [blockchainReceipt, setBlockchainReceipt] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Perform AI Extraction & Verification
  const runAiExtractionAndVerify = async () => {
    setIsScanning(true);
    setRegistrationError('');

    try {
      // In real scenario, image is uploaded to /api/ai/extract
      // If simulated or test scenario, provide the extracted fields
      if (!imageFile) {
        throw new Error('Please select or capture a medicine packaging image for physical verification.');
      }

      let extractedData = null;
      try {
        const aiRes = await api.extractMedicineImage(imageFile);
        if (aiRes && aiRes.medicineInfo) {
          extractedData = aiRes.medicineInfo;
        } else if (aiRes && aiRes.error) {
          throw new Error(aiRes.error);
        }
      } catch (e) {
        throw new Error(e.message || 'Image text extraction failed. Please ensure the medicine label is clear and legible.');
      }

      if (!extractedData) {
        throw new Error('Could not detect medicine details from the packaging image. Please verify label clarity or configure GROQ_API_KEY in .env.');
      }

      setAiExtracted(extractedData);

      // Verify input against AI extraction
      const verifyRes = await api.verifyBatchData({
        medicineName,
        batchNumber,
        expiryDate,
        composition,
        manufacturer: user?.organizationName,
      }, extractedData);

      setVerificationResult(verifyRes.verification);
      setStep(3);
    } catch (err) {
      setRegistrationError(err.message || 'AI verification failed');
    } finally {
      setIsScanning(false);
    }
  };

  // Confirm Registration to Blockchain and MongoDB
  const handleConfirmRegistration = async () => {
    setRegistering(true);
    setRegistrationError('');

    try {
      const payload = {
        medicineName,
        batchNumber,
        manufacturingDate,
        expiryDate,
        composition,
        quantity: parseInt(quantity, 10),
        mrp,
        sealId,
        aiExtracted,
      };

      const res = await api.registerBatch(payload);
      setBlockchainReceipt(res);
      setStep(4);
      showToast(`Batch '${batchNumber}' successfully registered on Hardhat blockchain!`, 'success');
      if (onSuccess) onSuccess(res.batch);
    } catch (err) {
      setRegistrationError(err.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="animate-slide" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={step > 1 && step < 4 ? () => setStep(step - 1) : onCancel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'transparent',
            color: '#64748b',
            fontSize: '0.8rem',
            padding: '4px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} /> {step === 1 ? 'Cancel' : 'Back'}
        </button>

        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', letterSpacing: '0.04em' }}>
          STEP {step} OF 4
        </div>
      </div>

      {registrationError && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          color: '#b91c1c',
          fontSize: '0.8rem',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          fontWeight: 600
        }}>
          <XCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          <span>{registrationError}</span>
        </div>
      )}

      {/* STEP 1: Enter Batch Details */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Register New Medicine Batch
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px' }}>
              Enter production batch details. These will be verified against the physical packaging via AI vision.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Medicine Brand / Name *
              </label>
              <input
                type="text"
                required
                placeholder="Enter medicine product name"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Batch Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter manufacturing batch number"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Quantity (Units) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="Enter total units produced"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Manufacturing Date *
                </label>
                <input
                  type="text"
                  placeholder="MM/YYYY"
                  required
                  value={manufacturingDate}
                  onChange={(e) => setManufacturingDate(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Expiry Date *
                </label>
                <input
                  type="text"
                  placeholder="MM/YYYY"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Active Composition / Strength
              </label>
              <input
                type="text"
                placeholder="Enter active formulation"
                value={composition}
                onChange={(e) => setComposition(e.target.value)}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem',
                  color: '#0f172a',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  MRP (₹)
                </label>
                <input
                  type="text"
                  placeholder="Enter MRP in INR"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Tamper Seal ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter tamper seal ID"
                  value={sealId}
                  onChange={(e) => setSealId(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.25)',
            }}
          >
            Continue to Package Scan <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* STEP 2: Medicine Package Image & AI Extraction */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Medicine Package AI Verification
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px' }}>
              Scan or upload the physical medicine package. Groq Vision will read printed labels and verify against your entered data.
            </p>
          </div>

          {/* Image Upload Area / Camera Mock */}
          <div style={{
            background: '#ffffff',
            border: '2px dashed #cbd5e1',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            position: 'relative'
          }}>
            {imagePreview ? (
              <div style={{ width: '100%', maxHeight: '200px', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
                <img src={imagePreview} alt="Package Preview" style={{ width: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Camera size={28} color="#2563eb" />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                  Capture or Upload Medicine Package
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  PNG, JPG, or WebP packaging image
                </div>
              </>
            )}

            <input
              type="file"
              accept="image/*"
              id="package-file-input"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
            <label
              htmlFor="package-file-input"
              style={{
                cursor: 'pointer',
                padding: '0.45rem 0.9rem',
                borderRadius: 'var(--radius-sm)',
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Upload size={14} /> {imagePreview ? 'Change Image' : 'Select Photo'}
            </label>
          </div>

          <button
            type="button"
            disabled={isScanning}
            onClick={runAiExtractionAndVerify}
            style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.25)',
              opacity: isScanning ? 0.7 : 1,
            }}
          >
            {isScanning ? (
              <>Running Groq Vision Analysis...</>
            ) : (
              <>Extract & Verify Packaging <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      )}

      {/* STEP 3: Verification Result & Baseline Generation */}
      {step === 3 && verificationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Verification Comparison Result
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px' }}>
              Cross-verifying manufacturer input against visual AI extracted packaging details.
            </p>
          </div>

          {/* Verification Status Banner */}
          {verificationResult.verified ? (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              textAlign: 'center',
            }}>
              <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669', letterSpacing: '0.03em' }}>
                MANUFACTURER VERIFICATION ✓ PASSED
              </div>
              <div style={{ fontSize: '0.78rem', color: '#065f46', marginTop: '0.25rem' }}>
                All printed package fields perfectly match manufacturer input. Cryptographic baseline ready for blockchain anchoring.
              </div>
            </div>
          ) : (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              textAlign: 'center',
            }}>
              <XCircle size={36} color="#ef4444" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b91c1c', letterSpacing: '0.03em' }}>
                MANUFACTURER VERIFICATION ✗ FAILED
              </div>
              <div style={{ fontSize: '0.78rem', color: '#991b1b', marginTop: '0.25rem' }}>
                Discrepancies detected between input and package image on: <strong>{verificationResult.failedFields?.join(', ')}</strong>. Batch registration is blocked.
              </div>
            </div>
          )}

          {/* Field-by-Field Breakdown */}
          <div style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ padding: '0.65rem 0.9rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', borderBottom: '1px solid #e2e8f0' }}>
              Field-by-Field Check Audit
            </div>
            <div style={{ padding: '0.5rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(verificationResult.fieldChecks || {}).map(([key, check]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{check.field}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      In: {check.entered} | Extracted: {check.extracted}
                    </div>
                  </div>
                  <div>
                    {check.match ? (
                      <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                        <Check size={14} /> Match
                      </span>
                    ) : (
                      <span style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                        <X size={14} /> Mismatch
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          {verificationResult.verified ? (
            <button
              type="button"
              disabled={registering}
              onClick={handleConfirmRegistration}
              style={{
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                border: 'none',
                cursor: registering ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 15px rgba(5, 150, 105, 0.25)',
                opacity: registering ? 0.7 : 1,
              }}
            >
              <Cpu size={18} />
              {registering ? 'Committing to Blockchain...' : 'Commit to Smart Contract'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #cbd5e1',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Back to Edit Batch Details
            </button>
          )}
        </div>
      )}

      {/* STEP 4: Immutable Blockchain Registration Receipt */}
      {step === 4 && blockchainReceipt && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #059669, #047857)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
              boxShadow: '0 4px 15px rgba(5, 150, 105, 0.3)'
            }}>
              <ShieldCheck size={32} color="#ffffff" />
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Batch Registered on Ledger
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px' }}>
              Immutable pharmaceutical record created on the PharmaShield Ethereum smart contract.
            </p>
          </div>

          {/* Receipt Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Registered Batch</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-mono)' }}>
                {batchNumber}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600 }}>
                {medicineName}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: '#64748b' }}>Initial Holder: </span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{user?.organizationName || 'Licensed Manufacturer'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Status: </span>
                <span style={{ color: '#059669', fontWeight: 700 }}>Registered</span>
              </div>
            </div>

            {/* Cryptographic Baseline Fingerprint */}
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Batch Fingerprint
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>
                {blockchainReceipt.trustedBaseline?.batchFingerprint || 'FP-8392F1A0B2C9'}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                Hash: {blockchainReceipt.trustedBaseline?.trustedDataHash?.substring(0, 32)}...
              </div>
            </div>

            {/* Blockchain Transaction Evidence */}
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Blockchain Ledger Evidence
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Block: <strong style={{ color: '#0f172a' }}>#{blockchainReceipt.blockchainReceipt?.blockNumber || 1}</strong>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#475569', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                Tx: {blockchainReceipt.blockchainReceipt?.transactionHash || '0xac09...'}
              </div>
            </div>
          </div>

          <div style={{
            background: '#eff6ff',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #bfdbfe',
            fontSize: '0.75rem',
            color: '#1d4ed8',
            textAlign: 'center',
            fontWeight: 500
          }}>
            ✦ Automatic Reflection: This batch is now live on the <strong>Authority Portal</strong> without manual refresh!
          </div>

          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.88rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.25)'
            }}
          >
            Return to Manufacturer Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
