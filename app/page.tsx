"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { createWorker } from 'tesseract.js';
import { quickScan } from "@/lib/redFlags";

// Debounce utility
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

type Analysis = {
  verdict: "SAFE" | "UNSAFE" | "UNKNOWN";
  threatLevel: string;
  text: string; // full formatted block
};

export default function HomePage() {
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [context] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number; premium: boolean }>({ used: 0, limit: 5, premium: false });
  const [email, setEmail] = useState("");
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [highContrast, setHighContrast] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(true);
  const [fontSize, setFontSize] = useState(16); // in px
  const [activeSection, setActiveSection] = useState<'input' | 'results'>('input');
  const [redFlag, setRedFlag] = useState<string | null>(null);
  const [scanPhase, setScanPhase] = useState<'idle' | 'quick-scan' | 'ai-scan'>('idle');
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [fullText, setFullText] = useState('');
  const lastResultTextRef = useRef<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'email' | 'text'>('email');
  const [showScreenshotHelp, setShowScreenshotHelp] = useState(false);

  // Generate device fingerprint on mount
  useEffect(() => {
    const generateFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch (error) {
        console.warn("Fingerprint generation failed, using fallback:", error);
        // Fallback will be handled by server-side UUID
      }
    };
    generateFingerprint();
  }, []);

  useEffect(() => {
    if (fingerprint) {
      fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint })
      }).then(r => r.json()).then(setUsage).catch(() => {});
    }
  }, [fingerprint]);

  // Typing effect for AI analysis text
  useEffect(() => {
    if (fullText && fullText !== lastResultTextRef.current) {
      console.log('🎬 Starting typing animation for:', fullText.substring(0, 50) + '...');
      lastResultTextRef.current = fullText;
      setIsTyping(true);
      setDisplayedText('');
      let index = 0;
      const text = fullText;
      const typeSpeed = 15; // milliseconds per character

      const typeInterval = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.slice(0, index + 1));
          index++;
        } else {
          clearInterval(typeInterval);
          setIsTyping(false);
          console.log('✅ Typing animation completed');
        }
      }, typeSpeed);

      return () => clearInterval(typeInterval);
    }
  }, [fullText]);

  // Red flag check function (moved to submission time)
  const checkForRedFlags = (text: string) => {
    console.log('🔍 ScamBomb: Running local red flag scan...');
    const hit = quickScan(text);
    if (hit) {
      console.log('🚨 ScamBomb: Red flag detected:', hit);
      setRedFlag(typeof hit === 'string' ? hit : hit.source);
      return true;
    } else {
      console.log('✅ ScamBomb: No red flags found in local scan');
      setRedFlag(null);
      return false;
    }
  };

  // OCR function using Tesseract.js
  const performOCR = async (file: File) => {
    setOcrLoading(true);
    try {
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      console.log('📝 OCR completed, extracted text:', text.substring(0, 100) + '...');
      setBody(prev => prev + (prev ? '\n\n' : '') + text.trim());
      setImageFile(null);
      setImagePreview(null);
    } catch (error) {
      console.error('OCR failed:', error);
      alert('Failed to extract text from image. Please try again or paste the text manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Handle image file selection
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const analyze = async () => {
    setLoading(true);
    setResult(null);

    // First, run the quick local red flag scan
    console.log('🔍 ScamBomb: Starting analysis with quick local scan...');

    // Add a brief delay to show the loading state for the quick scan
    await new Promise(resolve => setTimeout(resolve, 100));

    const hasRedFlags = checkForRedFlags(body);

    if (hasRedFlags) {
      // Red flags found - stop here and let user decide (stay in input section)
      console.log('🚨 ScamBomb: Red flags detected - waiting for user decision');
      setLoading(false);
      return;
    }

    // No red flags found - proceed to AI analysis
    await proceedWithAIAnalysis();
  };

  const proceedWithAIAnalysis = async () => {
    setLoading(true);
    setResult(null);
    setDisplayedText('');
    setIsTyping(false);
    lastResultTextRef.current = null;
    setActiveSection('results'); // Open results section for AI analysis

    console.log('✅ ScamBomb: Proceeding to AI analysis...');

    try {
      const res = await fetch('/api/analyze', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender, body, context, fingerprint })
      });

      if (res.status === 402) {
        if (confirm("You've hit the free limit. Upgrade to premium?")) {
          const pay = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, fingerprint })
          });
          const { url } = await pay.json();
          if (url) window.location.href = url;
        }
        return;
      }

      const data = await res.json();
      setResult(data);
      setFullText(data.text);
      // Refresh usage with fingerprint after successful analysis
      if (fingerprint) {
        const u = await fetch("/api/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint })
        }).then(r => r.json());
        setUsage(u);
      }
    } catch (e) {
      console.error("Analysis error:", e);
      alert("Analysis failed. Please check your API keys are configured correctly.");
    } finally {
      setLoading(false);
    }
  };

  const playInstructions = () => {
    const instructions = "Welcome to ScamBomb. To check a message, first enter the sender information. Then paste the message content. Optionally add context. Finally, click the Analyze Message button. Wait for results.";
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(instructions);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    } else {
      alert("Voice instructions not supported in this browser.");
    }
  };

  const baseFontSize = `${fontSize}px`;
  const largeFontSize = `${fontSize + 2}px`;
  const buttonHeight = '60px'; // at least 44px

  return (
    <div style={{
      minHeight: '100vh',
      background: highContrast ? '#000000' : '#0B1324',
      color: highContrast ? '#ffffff' : 'white',
      fontSize: baseFontSize,
      position: 'relative'
    }}>
      {/* Help Button - Fixed at top right */}
      <button
        onClick={() => setShowHelp(true)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '15px 20px',
          borderRadius: '10px',
          border: 'none',
          background: '#ff6b6b',
          color: 'white',
          fontSize: largeFontSize,
          fontWeight: 'bold',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          minHeight: buttonHeight
        }}
      >
        ❓ Need Help?
      </button>

      {/* Accessibility Controls */}
      <div style={{
        position: 'fixed',
        top: showAccessibility ? '20px' : 'auto',
        bottom: showAccessibility ? 'auto' : '20px',
        left: '20px',
        zIndex: 1000,
        background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.9)',
        border: highContrast ? '3px solid #000000' : '2px solid rgba(51, 65, 85, 0.5)',
        borderRadius: '10px',
        padding: showAccessibility ? '15px' : '5px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease'
      }}>
        {showAccessibility ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '5px'
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: highContrast ? '#000000' : '#f1f5f9'
              }}>
                Accessibility
              </span>
              <button
                onClick={() => setShowAccessibility(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: highContrast ? '#000000' : '#94a3b8',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
            <button
              onClick={() => setHighContrast(!highContrast)}
              style={{
                width: '100%',
                padding: '12px 15px',
                borderRadius: '5px',
                border: '2px solid white',
                background: highContrast ? 'white' : 'transparent',
                color: highContrast ? 'black' : 'white',
                fontSize: '14px',
                cursor: 'pointer',
                minHeight: '44px',
                fontWeight: 'bold'
              }}
            >
              High Contrast
            </button>
            <button
              onClick={() => setFontSize(Math.min(fontSize + 2, 28))}
              style={{
                width: '100%',
                padding: '12px 15px',
                borderRadius: '5px',
                border: '2px solid white',
                background: 'transparent',
                color: highContrast ? 'black' : 'white',
                fontSize: '14px',
                cursor: 'pointer',
                minHeight: '44px',
                fontWeight: 'bold'
              }}
            >
              + Font Size
            </button>
            <button
              onClick={() => setFontSize(Math.max(fontSize - 2, 16))}
              style={{
                width: '100%',
                padding: '12px 15px',
                borderRadius: '5px',
                border: '2px solid white',
                background: 'transparent',
                color: highContrast ? 'black' : 'white',
                fontSize: '14px',
                cursor: 'pointer',
                minHeight: '44px',
                fontWeight: 'bold'
              }}
            >
              - Font Size
            </button>

          </div>
        ) : (
          <button
            onClick={() => setShowAccessibility(true)}
            style={{
              background: highContrast ? '#666666' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontWeight: 'bold'
            }}
          >
            ♿ Accessibility
          </button>
        )}
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: highContrast ? '#ffffff' : '#1e293b',
            color: highContrast ? '#000000' : 'white',
            padding: '30px',
            borderRadius: '15px',
            maxWidth: '600px',
            fontSize: largeFontSize,
            textAlign: 'center'
          }}>
            <h2 style={{ marginTop: 0, fontSize: '24px' }}>How to Use ScamBomb</h2>
            <p style={{ lineHeight: 1.6 }}>
              1. Enter the sender's information (email, phone, or name).<br/>
              2. Paste the full message content OR upload a screenshot for OCR.<br/>
              3. Add any additional context if available.<br/>
              4. Click "Analyze Message" and wait for results.<br/>
              5. Review the safety verdict and follow recommendations.
            </p>
            <button
              onClick={playInstructions}
              style={{
                padding: '15px 20px',
                borderRadius: '10px',
                border: 'none',
                background: '#22c55e',
                color: 'white',
                fontSize: largeFontSize,
                cursor: 'pointer',
                margin: '10px',
                minHeight: buttonHeight
              }}
            >
              🔊 Play Instructions
            </button>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                padding: '15px 20px',
                borderRadius: '10px',
                border: 'none',
                background: '#6b7280',
                color: 'white',
                fontSize: largeFontSize,
                cursor: 'pointer',
                margin: '10px',
                minHeight: buttonHeight
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Screenshot Help Modal */}
      {showScreenshotHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: highContrast ? '#ffffff' : '#1e293b',
            color: highContrast ? '#000000' : 'white',
            padding: '30px',
            borderRadius: '15px',
            maxWidth: '700px',
            fontSize: largeFontSize,
            textAlign: 'center'
          }}>
            <h2 style={{ marginTop: 0, fontSize: '24px' }}>📸 How to Take a Screenshot</h2>
            <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
              {/* iPhone Instructions */}
              <div style={{
                flex: '1',
                minWidth: '250px',
                padding: '20px',
                background: highContrast ? '#f0f0f0' : 'rgba(30, 41, 59, 0.5)',
                borderRadius: '10px',
                textAlign: 'left'
              }}>
                <h3 style={{ marginTop: 0, color: highContrast ? '#000000' : '#22c55e' }}>📱 iPhone</h3>
                <ol style={{ lineHeight: 1.8, margin: 0, paddingLeft: '20px' }}>
                  <li>Open the suspicious text message</li>
                  <li>Press and hold the <strong>Side button</strong> (right edge)</li>
                  <li>While holding, quickly press the <strong>Volume Up button</strong></li>
                  <li>Release both buttons</li>
                  <li>The screenshot will appear as a thumbnail</li>
                </ol>
                <p style={{ marginTop: '15px', fontSize: baseFontSize, color: highContrast ? '#000000' : '#94a3b8' }}>
                  <em>Alternative: Swipe up from the bottom corner with your palm</em>
                </p>
              </div>

              {/* Android Instructions */}
              <div style={{
                flex: '1',
                minWidth: '250px',
                padding: '20px',
                background: highContrast ? '#f0f0f0' : 'rgba(30, 41, 59, 0.5)',
                borderRadius: '10px',
                textAlign: 'left'
              }}>
                <h3 style={{ marginTop: 0, color: highContrast ? '#000000' : '#22c55e' }}>🤖 Android</h3>
                <ol style={{ lineHeight: 1.8, margin: 0, paddingLeft: '20px' }}>
                  <li>Open the suspicious text message</li>
                  <li>Press and hold the <strong>Power button</strong> + <strong>Volume Down button</strong> simultaneously</li>
                  <li>Hold for 1-2 seconds</li>
                  <li>Release both buttons</li>
                  <li>You'll see a screenshot notification</li>
                </ol>
                <p style={{ marginTop: '15px', fontSize: baseFontSize, color: highContrast ? '#000000' : '#94a3b8' }}>
                  <em>Note: Button combinations may vary by device manufacturer</em>
                </p>
              </div>
            </div>
            <div style={{ marginTop: '20px', padding: '15px', background: highContrast ? '#e0e0e0' : 'rgba(71, 85, 105, 0.3)', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: baseFontSize, fontWeight: 'bold' }}>
                💡 Tip: Make sure the entire suspicious message is visible in your screenshot for the best analysis.
              </p>
            </div>
            <button
              onClick={() => setShowScreenshotHelp(false)}
              style={{
                padding: '15px 30px',
                borderRadius: '10px',
                border: 'none',
                background: highContrast ? '#000000' : '#22c55e',
                color: highContrast ? '#ffffff' : 'white',
                fontSize: largeFontSize,
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '20px',
                minHeight: buttonHeight
              }}
            >
              Got it! 📸
            </button>
          </div>
        </div>
      )}

      <main style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '32px 1rem 2rem 1rem' // extra top padding for fixed buttons
      }}>
        {/* Hero Section */}
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <a
            href="https://scambomb.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            <Image
              src="/logo.png"
              alt="ScamBomb"
              width={150}
              height={150}
              style={{
                maxHeight: '62px',
                width: 'auto',
                marginBottom: '1rem',
                cursor: 'pointer',
                transition: 'opacity 0.2s ease'
              }}
            />
          </a>

        </div>



        {/* Accordion Container */}
        <div style={{
          background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
          border: highContrast ? '3px solid #000000' : '1px solid rgba(51, 65, 85, 0.5)',
          borderRadius: '15px',
          overflow: 'hidden',
          fontSize: baseFontSize
        }}>
          {/* Input Section Header */}
          <button
            onClick={() => setActiveSection('input')}
            style={{
              width: '100%',
              padding: '20px 30px',
              background: activeSection === 'input' ? (highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
              border: 'none',
              borderBottom: activeSection === 'input' ? 'none' : `1px solid ${highContrast ? '#000000' : 'rgba(51, 65, 85, 0.5)'}`,
              color: highContrast ? '#000000' : '#f1f5f9',
              fontSize: largeFontSize,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left'
            }}
          >
            <span>🔍 Analyze Your Message</span>
            <span style={{
              transform: activeSection === 'input' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease'
            }}>▼</span>
          </button>

          {/* Input Section Content */}
          <div style={{
            maxHeight: activeSection === 'input' ? '2000px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.5s ease-in-out',
            padding: activeSection === 'input' ? '0 30px 30px' : '0 30px'
          }}>
            <p style={{
              color: highContrast ? '#000000' : '#94a3b8',
              fontSize: baseFontSize,
              marginBottom: '20px'
            }}>
              Paste any suspicious message to check for potential threats
            </p>

            {/* Message Type Toggle */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '30px'
            }}>
              <div style={{
                display: 'flex',
                background: highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)',
                borderRadius: '50px',
                padding: '5px',
                border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                position: 'relative'
              }}>
                <button
                  onClick={() => setMessageType('email')}
                  style={{
                    padding: '15px 30px',
                    borderRadius: '45px',
                    border: 'none',
                    background: messageType === 'email' ? (highContrast ? '#000000' : '#22c55e') : 'transparent',
                    color: messageType === 'email' ? (highContrast ? '#ffffff' : 'white') : (highContrast ? '#000000' : '#94a3b8'),
                    fontSize: largeFontSize,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minWidth: '150px',
                    zIndex: 2
                  }}
                >
                  📧 Email
                </button>
                <button
                  onClick={() => setMessageType('text')}
                  style={{
                    padding: '15px 30px',
                    borderRadius: '45px',
                    border: 'none',
                    background: messageType === 'text' ? (highContrast ? '#000000' : '#22c55e') : 'transparent',
                    color: messageType === 'text' ? (highContrast ? '#ffffff' : 'white') : (highContrast ? '#000000' : '#94a3b8'),
                    fontSize: largeFontSize,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minWidth: '150px',
                    zIndex: 2
                  }}
                >
                  📱 Text Message
                </button>
              </div>
            </div>

            {/* Image Upload Section - Only show for Text Message */}
            {messageType === 'text' && (
              <div style={{
                marginBottom: '20px',
                opacity: messageType === 'text' ? 1 : 0,
                transform: messageType === 'text' ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'all 0.3s ease-in-out'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '10px'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: largeFontSize,
                    fontWeight: 600,
                    color: highContrast ? '#000000' : '#f1f5f9',
                    margin: 0
                  }}>
                    📸 Upload Screenshot (OCR)
                  </label>
                  <button
                    onClick={() => setShowScreenshotHelp(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: highContrast ? '#000000' : '#94a3b8',
                      fontSize: '18px',
                      cursor: 'pointer',
                      padding: '5px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '30px',
                      height: '30px'
                    }}
                    title="How to take a screenshot"
                  >
                    ❓
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    style={{
                      padding: '10px',
                      borderRadius: '5px',
                      border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                      background: highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)',
                      color: highContrast ? '#000000' : 'white',
                      fontSize: baseFontSize,
                      minHeight: '44px'
                    }}
                  />
                  {imageFile && (
                    <button
                      onClick={() => imageFile && performOCR(imageFile)}
                      disabled={ocrLoading}
                      style={{
                        padding: '10px 15px',
                        borderRadius: '5px',
                        border: 'none',
                        background: ocrLoading ? (highContrast ? '#cccccc' : '#6b7280') : (highContrast ? '#000000' : '#22c55e'),
                        color: highContrast ? '#ffffff' : 'white',
                        fontSize: baseFontSize,
                        cursor: ocrLoading ? 'not-allowed' : 'pointer',
                        minHeight: '44px',
                        fontWeight: 'bold'
                      }}
                    >
                      {ocrLoading ? '🔄 Extracting Text...' : '📝 Extract Text'}
                    </button>
                  )}
                  {imageFile && (
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      style={{
                        padding: '10px 15px',
                        borderRadius: '5px',
                        border: 'none',
                        background: highContrast ? '#666666' : '#6b7280',
                        color: 'white',
                        fontSize: baseFontSize,
                        cursor: 'pointer',
                        minHeight: '44px'
                      }}
                    >
                      ❌ Clear
                    </button>
                  )}
                </div>
                {imagePreview && (
                  <div style={{ marginTop: '10px' }}>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{
                        maxWidth: '300px',
                        maxHeight: '200px',
                        borderRadius: '5px',
                        border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)'
                      }}
                    />
                  </div>
                )}
                <p style={{
                  fontSize: baseFontSize,
                  color: highContrast ? '#000000' : '#94a3b8',
                  marginTop: '5px',
                  marginBottom: '5px'
                }}>
                  Upload a screenshot of a suspicious text message. We'll extract the text automatically.
                </p>
                <p style={{
                  fontSize: '13px',
                  color: highContrast ? '#000000' : '#64748b',
                  marginTop: '0',
                  marginBottom: '0'
                }}>
                  🔒 Your image is processed immediately and never stored or shared.
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gap: '20px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: largeFontSize,
                  fontWeight: 600,
                  color: highContrast ? '#000000' : '#f1f5f9',
                  marginBottom: '10px'
                }}>
                  👤 Step 1: Sender Information
                </label>
                <input
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="Email address, phone number, or sender name"
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    borderRadius: '10px',
                    border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                    background: highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)',
                    color: highContrast ? '#000000' : 'white',
                    fontSize: baseFontSize,
                    outline: 'none',
                    minHeight: '50px'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: largeFontSize,
                  fontWeight: 600,
                  color: highContrast ? '#000000' : '#f1f5f9',
                  marginBottom: '10px'
                }}>
                  📝 Step 2: Message Content
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Paste the full message content here..."
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    borderRadius: '10px',
                    border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                    background: highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)',
                    color: highContrast ? '#000000' : 'white',
                    fontSize: baseFontSize,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    minHeight: '120px'
                  }}
                />

                {redFlag && (
                  <div style={{
                    marginTop: '15px',
                    padding: '15px 20px',
                    background: 'transparent',
                    color: highContrast ? '#000000' : 'white',
                    borderRadius: '10px',
                    border: highContrast ? '5px solid #000000' : '5px solid #ff6b6b',
                    fontSize: baseFontSize,
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '2em' }}>⚠️</span> Red-flag phrase detected: <span style={{ color: highContrast ? '#ff0000' : '#ff6b6b' }}>"{redFlag}"</span>
                    <br />
                    <br />
                    Have you seen enough? Are you ready to BOMB it, stay safe and never see this message again?
                    <br />
                    OR would you like to proceed with a FULL AI SCAN?
                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={async () => {
                          setRedFlag(null);
                          await proceedWithAIAnalysis();
                        }}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '5px',
                          border: '2px solid #F5C84C',
                          background: highContrast ? '#ffffff' : '#000000',
                          color: highContrast ? '#000000' : '#F5C84C',
                          fontSize: baseFontSize,
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          minWidth: '140px'
                        }}
                      >
                        🔍 FULL AI SCAN
                      </button>
                      <button
                        onClick={() => {
                          setRedFlag(null);
                          setBody('');
                          setSender('');
                          setResult(null);
                          setActiveSection('input');
                        }}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '5px',
                          border: 'none',
                          background: highContrast ? '#666666' : '#6b7280',
                          color: 'white',
                          fontSize: baseFontSize,
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          minWidth: '140px'
                        }}
                      >
                        💣 BOMB IT!
                      </button>
                    </div>
                  </div>
                )}
              </div>



              <button
                onClick={async () => {
                  await analyze();
                }}
                disabled={loading || !body.trim()}
                style={{
                  width: '100%',
                  padding: '20px',
                  borderRadius: '15px',
                  border: 'none',
                  background: loading ? (highContrast ? '#cccccc' : 'rgba(71, 85, 105, 0.8)') : (highContrast ? '#000000' : 'linear-gradient(135deg, #22c55e, #16a34a)'),
                  color: loading ? (highContrast ? '#000000' : '#94a3b8') : (highContrast ? '#ffffff' : 'white'),
                  fontSize: largeFontSize,
                  fontWeight: 700,
                  cursor: loading || !body.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  opacity: loading || !body.trim() ? 0.6 : 1,
                  minHeight: buttonHeight
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '3px solid #94a3b8',
                      borderTop: '3px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Quick scan for common scams...
                  </>
                ) : (
                  <>
                    🔍 Analyze Message
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Section Header */}
          <button
            onClick={() => setActiveSection('results')}
            style={{
              width: '100%',
              padding: '20px 30px',
              background: activeSection === 'results' ? (highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
              border: 'none',
              borderTop: `1px solid ${highContrast ? '#000000' : 'rgba(51, 65, 85, 0.5)'}`,
              color: highContrast ? '#000000' : '#f1f5f9',
              fontSize: largeFontSize,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left'
            }}
          >
            <span>📊 Scan Results</span>
            <span style={{
              transform: activeSection === 'results' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease'
            }}>▼</span>
          </button>

          {/* Results Section Content */}
          <div style={{
            maxHeight: activeSection === 'results' ? '2000px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.5s ease-in-out',
            padding: activeSection === 'results' ? '0 30px 30px' : '0 30px'
          }}>
            {!result && loading && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: highContrast ? '#000000' : '#94a3b8'
              }}>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  border: `4px solid ${highContrast ? '#000000' : '#22c55e'}`,
                  borderTop: '4px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 20px'
                }} />
                <h3 style={{
                  fontSize: largeFontSize,
                  fontWeight: 700,
                  color: highContrast ? '#000000' : '#f1f5f9',
                  marginBottom: '10px'
                }}>
                  🔍 Scanning your message...
                </h3>
                <p style={{ fontSize: baseFontSize }}>
                  Our AI is analyzing the content for potential security risks. This usually takes just a few seconds.
                </p>
              </div>
            )}

            {result && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '2rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: '50%',
                    background: result.verdict === 'SAFE' ? (highContrast ? '#000000' : 'linear-gradient(135deg, #22c55e, #16a34a)') :
                               result.verdict === 'UNSAFE' ? (highContrast ? '#ff0000' : 'linear-gradient(135deg, #ef4444, #dc2626)') :
                               (highContrast ? '#ffff00' : 'linear-gradient(135deg, #f59e0b, #d97706)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem'
                  }}>
                    {result.verdict === 'SAFE' ? '✅' : result.verdict === 'UNSAFE' ? '🚨' : '⚠️'}
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: largeFontSize,
                      fontWeight: 700,
                      color: highContrast ? '#000000' : '#f1f5f9',
                      margin: 0,
                      lineHeight: 1.2
                    }}>
                      {result.verdict === 'SAFE' ? '✅ Message is Safe' :
                       result.verdict === 'UNSAFE' ? '🚨 Security Risk Detected' :
                       '⚠️ Unable to Determine'}
                    </h3>
                    <p style={{
                      color: highContrast ? '#000000' : '#94a3b8',
                      margin: '0.5rem 0 0',
                      fontSize: baseFontSize,
                      fontWeight: 'bold'
                    }}>
                      Threat Level: {result.threatLevel}
                    </p>
                  </div>
                </div>

                {result.verdict === 'UNSAFE' && (
                  <div style={{
                    marginBottom: '2rem',
                    padding: '20px',
                    background: 'transparent',
                    color: highContrast ? '#000000' : 'white',
                    borderRadius: '10px',
                    border: highContrast ? '5px solid #000000' : '5px solid #ff6b6b',
                    fontSize: largeFontSize,
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '2em' }}>⚠️</span> Warning: This message appears to be dangerous. Do not click any links or provide personal information. Delete this message immediately.
                  </div>
                )}

                <div style={{
                  background: highContrast ? '#f0f0f0' : 'rgba(30, 41, 59, 0.8)',
                  border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '15px',
                  padding: '30px',
                  fontSize: baseFontSize,
                  lineHeight: 1.8,
                  color: highContrast ? '#000000' : '#e2e8f0',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                  position: 'relative'
                }}>
                  {displayedText}
                  {isTyping && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: '2px',
                        height: '1.2em',
                        backgroundColor: highContrast ? '#000000' : '#22c55e',
                        animation: 'blink 1s infinite',
                        marginLeft: '2px'
                      }}
                    />
                  )}
                </div>

                {result.verdict === 'SAFE' && (
                  <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    background: highContrast ? '#ccffcc' : '#22c55e',
                    color: highContrast ? '#000000' : 'white',
                    borderRadius: '10px',
                    fontSize: largeFontSize,
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}>
                    ✅ This message appears to be safe. You can proceed normally.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Combined Description & Usage Section */}
        <div style={{
          background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
          border: highContrast ? '3px solid #000000' : '1px solid rgba(51, 65, 85, 0.5)',
          borderRadius: '15px',
          padding: '20px',
          marginBottom: '2rem',
          fontSize: baseFontSize
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center'
          }}>
            {/* Description */}
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: largeFontSize,
                color: highContrast ? '#000000' : '#94a3b8',
                margin: 0,
                lineHeight: 1.6,
                fontWeight: 'bold'
              }}>
                Protect yourself from dangerous messages with our easy-to-use AI scanner.
                <br />
                <span style={{ color: highContrast ? '#000000' : '#22c55e', fontWeight: 600 }}>5 free checks</span>, then $5/month for unlimited protection.
              </p>
            </div>

            {/* Usage & Pricing in horizontal layout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '800px',
              gap: '2rem',
              flexWrap: 'wrap'
            }}>
              {/* Usage Info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flex: '1',
                minWidth: '200px'
              }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  background: usage.premium ? (highContrast ? '#000000' : 'linear-gradient(135deg, #22c55e, #16a34a)') : (highContrast ? '#666666' : '#475569'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 700
                }}>
                  {usage.premium ? '∞' : usage.used}
                </div>
                <div>
                  <div style={{
                    fontSize: largeFontSize,
                    fontWeight: 700,
                    color: highContrast ? '#000000' : '#f1f5f9',
                    marginBottom: '4px'
                  }}>
                    {usage.premium ? 'Premium Account' : 'Free Account'}
                  </div>
                  <div style={{
                    fontSize: baseFontSize,
                    color: highContrast ? '#000000' : '#94a3b8',
                    fontWeight: 'bold'
                  }}>
                    {usage.premium ? 'Unlimited scans' : `${usage.used} of ${usage.limit} free scans used`}
                  </div>
                  {!usage.premium && (
                    <div style={{
                      fontSize: baseFontSize,
                      color: highContrast ? '#000000' : '#64748b'
                    }}>
                      {usage.limit - usage.used} scans remaining
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Buttons */}
              {!usage.premium && (
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/stripe/checkout", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email, fingerprint, plan: 'annual' })
                        });
                        const data = await res.json();
                        if (data.url) {
                          window.location.href = data.url;
                        } else if (data.error) {
                          alert(`Payment setup failed: ${data.error}`);
                        } else {
                          alert("Payment setup failed. Please check your Stripe configuration.");
                        }
                      } catch (e) {
                        console.error("Checkout error:", e);
                        alert("Payment setup failed. Please check your Stripe API keys are configured correctly.");
                      }
                    }}
                    style={{
                      background: highContrast ? '#ffff00' : '#F5C84C',
                      color: highContrast ? '#000000' : '#0B1324',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: baseFontSize,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      minHeight: '55px',
                      minWidth: '175px'
                    }}
                  >
                    <div>⚡ Annual</div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>$49.99/year</div>
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/stripe/checkout", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email, fingerprint })
                        });
                        const data = await res.json();
                        if (data.url) {
                          window.location.href = data.url;
                        } else if (data.error) {
                          alert(`Payment setup failed: ${data.error}`);
                        } else {
                          alert("Payment setup failed. Please check your Stripe configuration.");
                        }
                      } catch (e) {
                        console.error("Checkout error:", e);
                        alert("Payment setup failed. Please check your Stripe API keys are configured correctly.");
                      }
                    }}
                    style={{
                      background: highContrast ? '#ffff00' : '#F5C84C',
                      color: highContrast ? '#000000' : '#0B1324',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: baseFontSize,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      minHeight: '55px',
                      minWidth: '175px'
                    }}
                  >
                    <div>⚡ Monthly</div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>$5/month</div>
                  </button>
                </div>
              )}

              {/* Guarantee Text */}
              {!usage.premium && (
                <div style={{
                  marginTop: '1rem',
                  textAlign: 'center',
                  fontSize: baseFontSize,
                  color: highContrast ? '#ffffff' : '#94a3b8',
                  lineHeight: 1.5
                }}>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>
                    🔒 No strings attached, "cancel any time for any reason" guarantee.
                  </p>
                </div>
              )}

              {usage.premium && (
                <button
                  onClick={async () => {
                    const res = await fetch("/api/stripe/portal", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ fingerprint })
                    });
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                    } else if (data.stripeDashboard) {
                      window.open(data.stripeDashboard, '_blank');
                      alert("Billing management coming soon. Opening Stripe dashboard for now.");
                    } else {
                      alert(data.error || "Billing management not available yet.");
                    }
                  }}
                  style={{
                    background: highContrast ? '#00ffff' : 'linear-gradient(135deg, #14b8a6, #0d9488)',
                    color: highContrast ? '#000000' : 'white',
                    border: 'none',
                    padding: '15px 20px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: baseFontSize,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    minHeight: '60px'
                  }}
                >
                  ⚙️ Manage Subscription
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          marginTop: '2rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: highContrast ? '#666666' : '#6b7280',
              color: 'white',
              border: 'none',
              padding: '15px 25px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: baseFontSize,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '50px'
            }}
          >
            🏠 Home
          </button>
          <button
            onClick={() => window.open('https://blog.scambomb.ai', '_blank')}
            style={{
              background: highContrast ? '#666666' : '#6b7280',
              color: 'white',
              border: 'none',
              padding: '15px 25px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: baseFontSize,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '50px'
            }}
          >
            📖 Read Blog
          </button>
        </div>

        {/* Footer */}
        <footer style={{
          marginTop: '3rem',
          padding: '2rem 0',
          borderTop: highContrast ? '2px solid #ffffff' : '1px solid rgba(51, 65, 85, 0.3)',
          textAlign: 'center',
          fontSize: baseFontSize,
          color: highContrast ? '#ffffff' : '#64748b'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>
              © 2025 ScamBomb. All rights reserved.
            </p>
          </div>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '0 1rem',
            lineHeight: 1.6
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              <strong>Disclaimer:</strong> ScamBomb provides educational guidance and risk signals.
              It does not provide legal, financial, or security guarantees.
              Always verify via official channels and remember:<br/>
              <strong>When in doubt... DON'T!</strong>
            </p>
          </div>
        </footer>

      </main>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          33% {
            transform: translateY(-10px) rotate(1deg);
          }
          66% {
            transform: translateY(5px) rotate(-1deg);
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes blink {
          0%, 50% {
            opacity: 1;
          }
          51%, 100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
