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
  const [showAccessibility, setShowAccessibility] = useState(false);
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
  const [showBombModal, setShowBombModal] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const bombButtonRef = useRef<HTMLButtonElement>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalDismissed, setUpgradeModalDismissed] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Access control logic - runs on mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await fetch('/api/user/profile', {
          method: 'GET',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const profile = await res.json();
          setUserProfile(profile);
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    };

    const checkAccess = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const safeSource = urlParams.get('safe_source');
      const sbid = urlParams.get('SBID');
      const authSuccess = urlParams.get('auth_success');
      const sessionToken = urlParams.get('session_token');

      // Check for existing authorization cookie
      const hasAuthCookie = document.cookie.includes('scambomb_authorized=true');

      // Handle OAuth callback
      if (authSuccess === 'true' && sessionToken) {
        console.log('✅ OAuth authentication successful');
        // Store session token for authenticated requests
        localStorage.setItem('scambomb_session_token', sessionToken);
        document.cookie = 'scambomb_authorized=true; max-age=2592000; path=/; SameSite=Lax';

        // Clean up URL after processing
        const cleanUrl = window.location.pathname + window.location.hash;
        history.replaceState(null, '', cleanUrl);

        setAccessGranted(true);
        // Fetch user profile after successful auth
        fetchUserProfile();
        return;
      }

      if (safeSource === 'true' && sbid && sbid.length > 0) {
        // Valid parameters - authorize user
        console.log('✅ Access granted via URL parameters');
        document.cookie = 'scambomb_authorized=true; max-age=2592000; path=/; SameSite=Lax';

        // Clean up URL immediately after authorization
        const cleanUrl = window.location.pathname + window.location.hash;
        history.replaceState(null, '', cleanUrl);

        setAccessGranted(true);
        // Check if user is already authenticated
        fetchUserProfile();
      } else if (hasAuthCookie) {
        // Return visitor with valid cookie
        console.log('✅ Access granted via authorization cookie');
        setAccessGranted(true);
        // Check if user is already authenticated
        fetchUserProfile();
      } else {
        // No valid access - show access denied
        console.log('❌ Access denied - no valid parameters or cookie');
        setShowAccessDenied(true);
      }
    };

    checkAccess();
  }, []);

  // Generate device fingerprint on mount
  useEffect(() => {
    const generateFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
        console.log('🔍 User Fingerprint:', result.visitorId); // Temporary logging
      } catch (error) {
        console.warn("Fingerprint generation failed, using fallback:", error);
        // Fallback will be handled by server-side UUID
      }
    };
    generateFingerprint();
  }, []);

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const sessionToken = localStorage.getItem('scambomb_session_token');
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }

    return headers;
  };

  useEffect(() => {
    if (fingerprint) {
      // Check for testing parameter to simulate exhausted free uses
      const urlParams = new URLSearchParams(window.location.search);
      const testExpired = urlParams.get('5_free_expired') === 'true';

      fetch("/api/usage", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ fingerprint })
      }).then(r => r.json()).then(usageData => {
        if (testExpired) {
          // Override usage to simulate 5 used out of 5
          setUsage({ ...usageData, used: 5, limit: 5 });
        } else {
          setUsage(usageData);
        }
      }).catch(() => {});
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
    // Check if free uses are exhausted and user hasn't dismissed the modal
    if (usage.used >= usage.limit && !usage.premium && !upgradeModalDismissed) {
      setShowUpgradeModal(true);
      return;
    }

    setLoading(true);
    setResult(null);

    // First, run the quick local red flag scan
    console.log('🔍 ScamBomb: Starting analysis with quick local scan...');
    console.log('📊 Usage Count:', usage.used); // Temporary logging
    console.log('🎯 Action Type: ai_scan'); // Temporary logging

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
        headers: getAuthHeaders(),
        body: JSON.stringify({ sender, body, context, fingerprint })
      });

      if (res.status === 402) {
        setShowUpgradeModal(true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResult(data);
      setFullText(data.text);
      // Refresh usage with fingerprint after successful analysis
      if (fingerprint) {
        const u = await fetch("/api/usage", {
          method: "POST",
          headers: getAuthHeaders(),
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

  // Show access denied screen if access not granted
  if (showAccessDenied) {
    return (
      <div style={{
        minHeight: '100vh',
        background: highContrast ? '#000000' : '#0B1324',
        color: highContrast ? '#ffffff' : 'white',
        fontSize: baseFontSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.9)',
          border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '600px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🔒</div>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: highContrast ? '#000000' : '#f1f5f9',
            marginBottom: '20px'
          }}>
            Access Restricted
          </h1>
          <p style={{
            fontSize: largeFontSize,
            color: highContrast ? '#000000' : '#94a3b8',
            lineHeight: 1.6,
            marginBottom: '30px'
          }}>
            This ScamBomb analyzer is only accessible through our official website to ensure a safe and controlled user experience.
          </p>

          <div style={{
            background: highContrast ? '#f0f0f0' : 'rgba(30, 41, 59, 0.8)',
            padding: '25px',
            borderRadius: '15px',
            marginBottom: '30px',
            textAlign: 'left'
          }}>
            <h3 style={{
              fontSize: largeFontSize,
              fontWeight: 700,
              color: highContrast ? '#000000' : '#f1f5f9',
              marginTop: 0,
              marginBottom: '15px'
            }}>
              How to Access ScamBomb:
            </h3>
            <ol style={{
              lineHeight: 1.8,
              margin: 0,
              paddingLeft: '20px',
              color: highContrast ? '#000000' : '#e2e8f0'
            }}>
              <li>Visit our main website: <strong>scambomb.com</strong></li>
              <li>Navigate to the analyzer section</li>
              <li>Click "Try ScamBomb" or similar access button</li>
              <li>You'll be automatically authorized to use the analyzer</li>
            </ol>
          </div>

          <div style={{
            display: 'flex',
            gap: '15px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => window.open('https://scambomb.com', '_blank')}
              style={{
                background: highContrast ? '#ffff00' : '#F5C84C',
                color: highContrast ? '#000000' : '#0B1324',
                border: 'none',
                padding: '15px 30px',
                borderRadius: '10px',
                fontSize: largeFontSize,
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: buttonHeight,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🌐 Visit ScamBomb.com
            </button>
            <button
              onClick={() => window.open('https://www.scambomb.com/blog', '_blank')}
              style={{
                background: 'transparent',
                color: highContrast ? '#000000' : 'white',
                border: '2px solid white',
                padding: '15px 30px',
                borderRadius: '10px',
                fontSize: largeFontSize,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: buttonHeight,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📖 Read Our Blog
            </button>
          </div>

          <p style={{
            fontSize: '14px',
            color: highContrast ? '#666666' : '#64748b',
            marginTop: '30px',
            lineHeight: 1.5
          }}>
            <em>This restriction helps prevent automated bots from wasting our resources and ensures all users get the full ScamBomb experience with proper guidance.</em>
          </p>
        </div>
      </div>
    );
  }

  // Main app content - only render if access granted
  return (
    <div style={{
      minHeight: '100vh',
      background: highContrast ? '#000000' : '#0B1324',
      color: highContrast ? '#ffffff' : 'white',
      fontSize: baseFontSize,
      position: 'relative'
    }}>
      {/* User Status & Help Button - Fixed at top right */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        zIndex: 1000
      }}>
        {userProfile && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.9)',
              border: highContrast ? '2px solid #000000' : '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '25px',
              padding: '8px 15px',
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s ease'
            }}
            onClick={() => window.location.href = '/account'}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '2px solid #F5C84C',
              background: '#F5C84C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#0B1324',
              overflow: 'hidden'
            }}>
              <Image
                src={userProfile.picture}
                alt="Profile"
                width={32}
                height={32}
                style={{
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  // Fallback to user's initial if image fails to load
                  const target = e.target as HTMLImageElement;
                  const fallbackText = userProfile.name
                    ? userProfile.name.charAt(0).toUpperCase()
                    : userProfile.email
                      ? userProfile.email.charAt(0).toUpperCase()
                      : '?';
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = fallbackText;
                  target.parentElement!.style.display = 'flex';
                  target.parentElement!.style.alignItems = 'center';
                  target.parentElement!.style.justifyContent = 'center';
                }}
              />
            </div>
            <span style={{
              color: highContrast ? '#000000' : '#f1f5f9',
              fontSize: baseFontSize,
              fontWeight: 600
            }}>
              Logged in
            </span>
          </div>
        )}
        <button
          onClick={() => setShowHelp(true)}
          style={{
            padding: '15px 20px',
            borderRadius: '10px',
            border: 'none',
            background: '#ff6b6b',
            color: 'white',
            fontSize: largeFontSize,
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            minHeight: buttonHeight
          }}
        >
          ❓ Need Help?
        </button>
      </div>

      {/* Accessibility Controls */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 1000
      }}>
        {/* Accessibility Toggle Button */}
        <button
          onClick={() => setShowAccessibility(!showAccessibility)}
          aria-expanded={showAccessibility}
          aria-controls="accessibility-menu"
          aria-label="Open accessibility settings menu"
          style={{
            width: '75px',
            height: '75px',
            border: 'none',
            borderRadius: '8px',
            background: '#87CEEB', // Light blue
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Main wheelchair frame */}
            <path d="M8 14h8v4H8z" fill="#0B1324" opacity="0.9"/>
            {/* Seat */}
            <rect x="9" y="12" width="6" height="2" fill="#0B1324"/>
            {/* Backrest */}
            <rect x="14" y="8" width="2" height="4" fill="#0B1324"/>
            {/* Large rear wheel */}
            <circle cx="16" cy="16" r="3" stroke="#0B1324" strokeWidth="1.5" fill="none"/>
            <circle cx="16" cy="16" r="0.5" fill="#0B1324"/>
            {/* Small front wheel */}
            <circle cx="8" cy="16" r="1.5" stroke="#0B1324" strokeWidth="1.5" fill="none"/>
            <circle cx="8" cy="16" r="0.3" fill="#0B1324"/>
            {/* Armrests */}
            <rect x="9" y="10" width="6" height="1" fill="#0B1324"/>
            {/* Footrests */}
            <rect x="7" y="17" width="2" height="1" fill="#0B1324"/>
            {/* Push handles */}
            <rect x="15" y="6" width="1" height="2" fill="#0B1324"/>
          </svg>
        </button>

        {/* Accessibility Menu */}
        {showAccessibility && (
          <div
            id="accessibility-menu"
            role="dialog"
            aria-labelledby="accessibility-title"
            style={{
              position: 'absolute',
              bottom: '85px',
              left: '0',
              background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.95)',
              border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '10px',
              padding: '15px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              minWidth: '200px',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <h3
                id="accessibility-title"
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: highContrast ? '#000000' : '#f1f5f9',
                  margin: 0
                }}
              >
                Accessibility Settings
              </h3>
              <button
                onClick={() => setShowAccessibility(false)}
                aria-label="Close accessibility settings"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: highContrast ? '#000000' : '#94a3b8',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => setHighContrast(!highContrast)}
                aria-pressed={highContrast}
                aria-label={`${highContrast ? 'Disable' : 'Enable'} high contrast mode`}
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  borderRadius: '6px',
                  border: '2px solid white',
                  background: highContrast ? 'white' : 'transparent',
                  color: highContrast ? 'black' : 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minHeight: '44px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = highContrast ? '#f0f0f0' : 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = highContrast ? 'white' : 'transparent';
                }}
              >
                High Contrast {highContrast ? '✓' : ''}
              </button>

              <button
                onClick={() => setFontSize(Math.min(fontSize + 2, 28))}
                aria-label={`Increase font size. Current size: ${fontSize}px`}
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  borderRadius: '6px',
                  border: '2px solid white',
                  background: 'transparent',
                  color: highContrast ? 'black' : 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minHeight: '44px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                + Font Size ({fontSize}px)
              </button>

              <button
                onClick={() => setFontSize(Math.max(fontSize - 2, 16))}
                aria-label={`Decrease font size. Current size: ${fontSize}px`}
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  borderRadius: '6px',
                  border: '2px solid white',
                  background: 'transparent',
                  color: highContrast ? 'black' : 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minHeight: '44px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                - Font Size ({fontSize}px)
              </button>
            </div>
          </div>
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
                background: highContrast ? '#ffff00' : '#F5C84C',
                color: highContrast ? '#000000' : '#0B1324',
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
                border: '2px solid white',
                background: 'transparent',
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

      {/* Bomb Success Modal */}
      {showBombModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000,
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <div style={{
            background: highContrast ? '#ffffff' : '#1e293b',
            color: highContrast ? '#000000' : 'white',
            padding: '40px',
            borderRadius: '20px',
            maxWidth: '500px',
            fontSize: largeFontSize,
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            animation: 'modalSlideUp 0.6s ease-out'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
            <h2 style={{ marginTop: 0, fontSize: '28px', color: highContrast ? '#000000' : '#22c55e' }}>Smart Move!</h2>
            <p style={{ lineHeight: 1.6, marginBottom: '25px', fontSize: largeFontSize }}>
              You've successfully BOMBED that suspicious message! Great job protecting yourself from potential scams.
            </p>

            <div style={{
              background: highContrast ? '#f0f0f0' : 'rgba(30, 41, 59, 0.8)',
              padding: '20px',
              borderRadius: '10px',
              marginBottom: '25px',
              textAlign: 'left'
            }}>
              <h3 style={{ marginTop: 0, fontSize: largeFontSize, color: highContrast ? '#000000' : '#f1f5f9' }}>Next Steps:</h3>
              <ul style={{ lineHeight: 1.8, margin: 0, paddingLeft: '20px' }}>
                <li><strong>Delete the message</strong> from your inbox</li>
                <li><strong>Block the sender</strong> to prevent future messages</li>
                <li><strong>Report as spam</strong> if your email app has that option - just say "report as spam"</li>
                <li><strong>For text messages:</strong> Block and report the number if your phone has that option</li>
              </ul>
            </div>

            <div style={{
              fontSize: '14px',
              color: highContrast ? '#666666' : '#94a3b8',
              marginBottom: '25px',
              lineHeight: 1.5
            }}>
              <em>This is an automated analysis and can make mistakes. If you're worried this message might be important, contact the supposed sender through official channels (not by replying to this suspicious message).</em>
            </div>

            <button
              onClick={() => {
                setShowBombModal(false);
                setRedFlag(null);
                setBody('');
                setSender('');
                setResult(null);
                setActiveSection('input');
              }}
              style={{
                padding: '15px 30px',
                borderRadius: '10px',
                border: 'none',
                background: highContrast ? '#ffff00' : '#F5C84C',
                color: highContrast ? '#000000' : '#0B1324',
                fontSize: largeFontSize,
                fontWeight: 'bold',
                cursor: 'pointer',
                minHeight: buttonHeight
              }}
            >
              Got it! Stay Safe 🛡️
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2500
        }}>
          <div style={{
            background: highContrast ? '#ffffff' : '#1e293b',
            color: highContrast ? '#000000' : 'white',
            padding: '40px',
            borderRadius: '20px',
            maxWidth: '500px',
            fontSize: largeFontSize,
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            animation: 'modalSlideUp 0.6s ease-out'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
            <h2 style={{ marginTop: 0, fontSize: '28px', color: highContrast ? '#000000' : '#F5C84C' }}>You're a Power User!</h2>
            <p style={{ lineHeight: 1.6, marginBottom: '25px', fontSize: largeFontSize }}>
              Looks like you're enjoying ScamBomb! Because you're a power user, we're giving you a special offer:
            </p>

            <div style={{
              background: highContrast ? '#f0f0f0' : 'rgba(30, 41, 59, 0.8)',
              padding: '25px',
              borderRadius: '15px',
              marginBottom: '25px',
              border: highContrast ? '3px solid #000000' : '2px solid #F5C84C'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🔥</div>
              <h3 style={{
                margin: '0 0 15px 0',
                fontSize: '24px',
                color: highContrast ? '#000000' : '#F5C84C'
              }}>
                LOGIN WITH GMAIL TODAY & GET 5 MORE FREE SCANS!
              </h3>
              <p style={{
                margin: 0,
                fontSize: baseFontSize,
                color: highContrast ? '#000000' : '#94a3b8',
                lineHeight: 1.5
              }}>
                Or upgrade to premium for unlimited protection at just $5/month.
              </p>
            </div>

            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={async () => {
                  setIsRedirecting(true);
                  try {
                    const authRes = await fetch("/api/auth/google", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({})
                    });
                    const authData = await authRes.json();
                    if (authData.url) {
                      window.location.href = authData.url;
                      return;
                    }
                  } catch (authError) {
                    console.error("Auth error:", authError);
                    setIsRedirecting(false);
                  }
                  alert("Authentication failed. Please try again.");
                  setIsRedirecting(false);
                }}
                disabled={isRedirecting}
                style={{
                  background: highContrast ? '#ffff00' : '#F5C84C',
                  color: highContrast ? '#000000' : '#0B1324',
                  border: 'none',
                  padding: '15px 30px',
                  borderRadius: '10px',
                  fontSize: largeFontSize,
                  fontWeight: 700,
                  cursor: isRedirecting ? 'not-allowed' : 'pointer',
                  minHeight: buttonHeight,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isRedirecting ? 0.6 : 1
                }}
              >
                {isRedirecting ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #0B1324',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Login with Gmail
                  </>
                )}
              </button>
              <button
                onClick={async () => {
                  setIsRedirecting(true);
                  try {
                    const res = await fetch("/api/stripe/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email, fingerprint })
                    });
                    const { url } = await res.json();
                    if (url) window.location.href = url;
                  } catch (e) {
                    console.error("Checkout error:", e);
                    alert("Payment setup failed. Please check your Stripe API keys are configured correctly.");
                    setIsRedirecting(false);
                  }
                }}
                disabled={isRedirecting}
                style={{
                  background: 'transparent',
                  color: highContrast ? '#000000' : 'white',
                  border: '2px solid white',
                  padding: '15px 30px',
                  borderRadius: '10px',
                  fontSize: largeFontSize,
                  fontWeight: 600,
                  cursor: isRedirecting ? 'not-allowed' : 'pointer',
                  minHeight: buttonHeight,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isRedirecting ? 0.6 : 1
                }}
              >
                {isRedirecting ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Redirecting...
                  </>
                ) : (
                  <>
                    💎 Upgrade to Premium
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => {
                setShowUpgradeModal(false);
                setUpgradeModalDismissed(true);
              }}
              style={{
                marginTop: '20px',
                background: 'transparent',
                color: highContrast ? '#666666' : '#64748b',
                border: 'none',
                fontSize: baseFontSize,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Maybe Later
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
                <h3 style={{ marginTop: 0, color: highContrast ? '#000000' : '#F5C84C' }}>📱 iPhone</h3>
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
                <h3 style={{ marginTop: 0, color: highContrast ? '#000000' : '#F5C84C' }}>🤖 Android</h3>
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
                background: highContrast ? '#ffff00' : '#F5C84C',
                color: highContrast ? '#000000' : '#0B1324',
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
              Do you want to check an email or a text/SMS message for potential threats?
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
                position: 'relative',
                cursor: 'pointer'
              }}>
                {/* Sliding background indicator */}
                <div style={{
                  position: 'absolute',
                  top: highContrast ? '8px' : '7px',
                  left: messageType === 'email' ? (highContrast ? '8px' : '7px') : `calc(50% + ${highContrast ? '4px' : '3.5px'})`,
                  width: `calc(50% - ${highContrast ? '11px' : '10px'})`,
                  height: `calc(100% - ${highContrast ? '16px' : '14px'})`,
                  background: highContrast ? '#000000' : '#F5C84C',
                  borderRadius: '45px',
                  transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 1
                }} />
                <button
                  onClick={() => setMessageType('email')}
                  style={{
                    padding: '15px 30px',
                    borderRadius: '45px',
                    border: 'none',
                    background: 'transparent',
                    color: messageType === 'email' ? (highContrast ? '#ffffff' : '#0B1324') : (highContrast ? '#000000' : '#94a3b8'),
                    fontSize: largeFontSize,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'color 0.3s ease',
                    minWidth: '180px',
                    zIndex: 2,
                    position: 'relative',
                    outline: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    textAlign: 'center'
                  }}
                >
                  <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                    <path d="M18 0H2C0.9 0 0.01 0.9 0.01 2L0 14C0 15.1 0.9 16 2 16H18C19.1 16 20 15.1 20 14V2C20 0.9 19.1 0 18 0ZM18 4L10 9L2 4V2L10 7L18 2V4Z" fill="#0B1324" stroke="#0B1324" strokeWidth="0.5"/>
                  </svg>
                  Email
                </button>
                <button
                  onClick={() => setMessageType('text')}
                  style={{
                    padding: '15px 30px',
                    borderRadius: '45px',
                    border: 'none',
                    background: 'transparent',
                    color: messageType === 'text' ? (highContrast ? '#ffffff' : '#0B1324') : (highContrast ? '#000000' : '#94a3b8'),
                    fontSize: largeFontSize,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'color 0.3s ease',
                    minWidth: '180px',
                    zIndex: 2,
                    position: 'relative',
                    outline: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    textAlign: 'center'
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
                        background: ocrLoading ? (highContrast ? '#cccccc' : '#6b7280') : (highContrast ? '#ffff00' : '#F5C84C'),
                        color: ocrLoading ? (highContrast ? '#000000' : 'white') : (highContrast ? '#000000' : '#0B1324'),
                        fontSize: baseFontSize,
                        cursor: ocrLoading ? 'not-allowed' : 'pointer',
                        minHeight: '44px',
                        fontWeight: 'bold'
                      }}
                    >
                      {ocrLoading ? '🔄 Extracting Text...' : '� Extract Text'}
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
                        border: '2px solid white',
                        background: 'transparent',
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
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      width={300}
                      height={200}
                      style={{
                        maxWidth: '300px',
                        maxHeight: '200px',
                        borderRadius: '5px',
                        border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                        objectFit: 'contain'
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
                <p style={{
                  fontSize: baseFontSize,
                  color: highContrast ? '#000000' : '#94a3b8',
                  margin: '0 0 15px 0',
                  fontStyle: 'italic'
                }}>
                  Optional - you can include sender details in the message content below if preferred
                </p>
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
                          // Check if free uses are exhausted and user hasn't dismissed the modal
                          if (usage.used >= usage.limit && !usage.premium && !upgradeModalDismissed) {
                            setShowUpgradeModal(true);
                            return;
                          }

                          setRedFlag(null);
                          await proceedWithAIAnalysis();
                        }}
                        disabled={upgradeModalDismissed && usage.used >= usage.limit && !usage.premium}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '5px',
                          border: '2px solid white',
                          background: 'transparent',
                          color: (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? (highContrast ? '#666666' : '#64748b') : (highContrast ? '#00ff00' : '#22c55e'),
                          fontSize: baseFontSize,
                          fontWeight: 'bold',
                          cursor: (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? 'not-allowed' : 'pointer',
                          minWidth: '140px',
                          opacity: (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? 0.5 : 1
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                          <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        FULL AI SCAN
                      </button>
                      <button
                        ref={bombButtonRef}
                        onClick={async () => {
                          // Check if free uses are exhausted and user hasn't dismissed the modal
                          if (usage.used >= usage.limit && !usage.premium && !upgradeModalDismissed) {
                            setShowUpgradeModal(true);
                            return;
                          }

                          console.log('💣 Bomb Action Triggered'); // Temporary logging
                          // Start explosion effect
                          setIsExploding(true);

                          // Add spin animation to the button using ref
                          if (bombButtonRef.current) {
                            bombButtonRef.current.style.animation = 'spin 0.5s ease-in-out';
                          }

                          // Refresh usage counter since this counts as a scan attempt
                          if (fingerprint) {
                            const u = await fetch("/api/usage", {
                              method: "POST",
                              headers: getAuthHeaders(),
                              body: JSON.stringify({ fingerprint, increment: true })
                            }).then(r => r.json());
                            setUsage(u);
                          }

                          // Show modal immediately and let animation play
                          console.log('Setting showBombModal to true');
                          setShowBombModal(true);
                        }}
                        disabled={upgradeModalDismissed && usage.used >= usage.limit && !usage.premium}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '5px',
                          border: '2px solid white',
                          background: 'transparent',
                          color: (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? (highContrast ? '#666666' : '#64748b') : (highContrast ? '#ff0000' : '#ef4444'),
                          fontSize: baseFontSize,
                          fontWeight: 'bold',
                          cursor: (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? 'not-allowed' : 'pointer',
                          minWidth: '140px',
                          opacity: (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? 0.5 : 1
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                          <circle cx="12" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="12" cy="14" r="3" fill="currentColor"/>
                          <path d="M12 7V4M15 10L17 8M9 10L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M12 4C10 2 8 3 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        BOMB IT!
                      </button>
                    </div>
                  </div>
                )}
              </div>



              <button
                onClick={async () => {
                  await analyze();
                }}
                disabled={loading || !body.trim() || (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium)}
                style={{
                  width: '100%',
                  padding: '20px',
                  borderRadius: '15px',
                  border: 'none',
                  background: loading || (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? (highContrast ? '#cccccc' : 'rgba(71, 85, 105, 0.8)') : (highContrast ? '#ffff00' : '#F5C84C'),
                  color: loading || (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? (highContrast ? '#666666' : '#64748b') : (highContrast ? '#000000' : '#0B1324'),
                  fontSize: largeFontSize,
                  fontWeight: 700,
                  cursor: loading || !body.trim() || (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  opacity: loading || !body.trim() || (upgradeModalDismissed && usage.used >= usage.limit && !usage.premium) ? 0.6 : 1,
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
                  overflow: 'auto',
                  position: 'relative'
                }}>
                  {isTyping ? (
                    <>
                      <pre style={{
                        margin: 0,
                        fontSize: 'inherit',
                        lineHeight: 'inherit',
                        color: 'inherit',
                        fontFamily: 'inherit',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {displayedText}
                      </pre>
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
                    </>
                  ) : (
                    <div style={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
                      {displayedText.split('\n').map((line, index) => {
                        // Check if this line starts the "Next Steps" section
                        if (line.trim().toLowerCase().startsWith('next steps:')) {
                          // Find the end of the Next Steps section (next section or end of text)
                          const remainingLines = displayedText.split('\n').slice(index + 1);
                          let nextStepsEndIndex = remainingLines.length;

                          // Look for the next major section (usually starts with a header)
                          for (let i = 0; i < remainingLines.length; i++) {
                            const nextLine = remainingLines[i].trim();
                            // If we find another section header (contains colon and is short), end here
                            if (nextLine.includes(':') && nextLine.length < 50 && !nextLine.includes('http') && !nextLine.match(/^\d+\./)) {
                              nextStepsEndIndex = i;
                              break;
                            }
                          }

                          const nextStepsLines = remainingLines.slice(0, nextStepsEndIndex);
                          const afterNextSteps = remainingLines.slice(nextStepsEndIndex);

                          return (
                            <div key={index}>
                              <div style={{
                                fontSize: `${parseInt(baseFontSize) * 2}px`,
                                fontWeight: 'bold',
                                color: highContrast ? '#000000' : '#F5C84C',
                                marginBottom: '15px',
                                marginTop: '20px'
                              }}>
                                {line}
                              </div>
                              <div style={{
                                fontSize: `${parseInt(baseFontSize) * 2}px`,
                                lineHeight: 1.6,
                                color: highContrast ? '#000000' : '#e2e8f0',
                                marginBottom: '20px'
                              }}>
                                {nextStepsLines.map((nextLine, nextIndex) => (
                                  <div key={nextIndex} style={{ marginBottom: '8px' }}>
                                    {nextLine}
                                  </div>
                                ))}
                              </div>
                              {afterNextSteps.map((afterLine, afterIndex) => (
                                <div key={`after-${afterIndex}`} style={{
                                  whiteSpace: 'pre-wrap',
                                  marginBottom: afterIndex === afterNextSteps.length - 1 ? 0 : 'inherit'
                                }}>
                                  {afterLine}
                                  {afterIndex < afterNextSteps.length - 1 && '\n'}
                                </div>
                              ))}
                            </div>
                          );
                        }

                        return (
                          <div key={index} style={{
                            whiteSpace: 'pre-wrap',
                            marginBottom: index === displayedText.split('\n').length - 1 ? 0 : 'inherit'
                          }}>
                            {line}
                            {index < displayedText.split('\n').length - 1 && '\n'}
                          </div>
                        );
                      })}
                    </div>
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
                  width: '100%',
                  fontSize: baseFontSize,
                  color: highContrast ? '#ffffff' : '#94a3b8',
                  lineHeight: 1.5,
                  textAlign: 'center'
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
            onClick={() => window.open('https://scambomb.com', '_blank')}
            style={{
              background: 'transparent',
              color: 'white',
              border: '2px solid white',
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
            onClick={() => window.open('https://www.scambomb.com/blog', '_blank')}
            style={{
              background: 'transparent',
              color: 'white',
              border: '2px solid white',
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

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(50px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
