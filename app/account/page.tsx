"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function AccountPage() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await fetch('/api/user/profile', {
          method: 'GET',
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem('scambomb_session_token')}`
          }
        });
        if (res.ok) {
          const profile = await res.json();
          setUserProfile(profile);
        } else {
          // Redirect to home if not authenticated
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const baseFontSize = `${16}px`;
  const largeFontSize = `${18}px`;
  const buttonHeight = '60px';

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: highContrast ? '#000000' : '#0B1324',
        color: highContrast ? '#ffffff' : 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: baseFontSize
      }}>
        <div style={{
          width: '4rem',
          height: '4rem',
          border: `4px solid ${highContrast ? '#ffffff' : '#F5C84C'}`,
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div style={{
        minHeight: '100vh',
        background: highContrast ? '#000000' : '#0B1324',
        color: highContrast ? '#ffffff' : 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: baseFontSize
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Access Denied</h2>
          <p>Please log in to view your account.</p>
          <button
            onClick={() => window.location.href = '/'}
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
              marginTop: '20px'
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: highContrast ? '#000000' : '#0B1324',
      color: highContrast ? '#ffffff' : 'white',
      fontSize: baseFontSize
    }}>
      {/* Header */}
      <header style={{
        padding: '20px',
        borderBottom: highContrast ? '2px solid #ffffff' : '1px solid rgba(71, 85, 105, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            color: 'inherit'
          }}
        >
          <Image
            src="/logo.png"
            alt="ScamBomb"
            width={120}
            height={120}
            style={{
              maxHeight: '40px',
              width: 'auto'
            }}
          />
        </Link>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.9)',
            border: highContrast ? '2px solid #000000' : '1px solid rgba(71, 85, 105, 0.5)',
            borderRadius: '25px',
            padding: '8px 15px'
          }}>
            <Image
              src={userProfile.picture}
              alt="Profile"
              width={32}
              height={32}
              style={{
                borderRadius: '50%',
                border: '2px solid #F5C84C'
              }}
            />
            <span style={{
              color: highContrast ? '#000000' : '#f1f5f9',
              fontSize: baseFontSize,
              fontWeight: 600
            }}>
              Logged in
            </span>
          </div>
        </div>
      </header>

      <main style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 20px'
      }}>
        {/* Profile Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          <Image
            src={userProfile.picture}
            alt="Profile Picture"
            width={120}
            height={120}
            style={{
              borderRadius: '50%',
              border: '4px solid #F5C84C',
              marginBottom: '20px'
            }}
          />
          <h1 style={{
            fontSize: '2.5rem',
            color: highContrast ? '#ffffff' : '#f1f5f9',
            marginBottom: '10px'
          }}>
            {userProfile.name}
          </h1>
          <p style={{
            fontSize: largeFontSize,
            color: highContrast ? '#ffffff' : '#94a3b8',
            marginBottom: '5px'
          }}>
            {userProfile.email}
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: userProfile.is_premium ? (highContrast ? '#000000' : 'linear-gradient(135deg, #22c55e, #16a34a)') : (highContrast ? '#666666' : '#475569'),
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: baseFontSize,
            fontWeight: 600
          }}>
            {userProfile.is_premium ? '💎 Premium Account' : '🆓 Free Account'}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {/* Total Scans */}
          <div style={{
            background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
            border: highContrast ? '3px solid #000000' : '1px solid rgba(71, 85, 105, 0.5)',
            borderRadius: '15px',
            padding: '30px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🔍</div>
            <h3 style={{
              fontSize: '2rem',
              color: highContrast ? '#000000' : '#f1f5f9',
              margin: '0 0 10px 0'
            }}>
              {userProfile.total_scans || 0}
            </h3>
            <p style={{
              fontSize: largeFontSize,
              color: highContrast ? '#000000' : '#94a3b8',
              margin: 0,
              fontWeight: 600
            }}>
              Total Scans
            </p>
          </div>

          {/* Total Bombs */}
          <div style={{
            background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
            border: highContrast ? '3px solid #000000' : '1px solid rgba(71, 85, 105, 0.5)',
            borderRadius: '15px',
            padding: '30px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💣</div>
            <h3 style={{
              fontSize: '2rem',
              color: highContrast ? '#000000' : '#f1f5f9',
              margin: '0 0 10px 0'
            }}>
              {userProfile.total_bombs || 0}
            </h3>
            <p style={{
              fontSize: largeFontSize,
              color: highContrast ? '#000000' : '#94a3b8',
              margin: 0,
              fontWeight: 600
            }}>
              Messages Bombed
            </p>
          </div>

          {/* Free Uses Remaining */}
          <div style={{
            background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
            border: highContrast ? '3px solid #000000' : '1px solid rgba(71, 85, 105, 0.5)',
            borderRadius: '15px',
            padding: '30px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎁</div>
            <h3 style={{
              fontSize: '2rem',
              color: highContrast ? '#000000' : '#f1f5f9',
              margin: '0 0 10px 0'
            }}>
              {userProfile.free_uses_remaining || 0}
            </h3>
            <p style={{
              fontSize: largeFontSize,
              color: highContrast ? '#000000' : '#94a3b8',
              margin: 0,
              fontWeight: 600
            }}>
              Free Scans Left
            </p>
          </div>

          {/* Safety Score */}
          <div style={{
            background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
            border: highContrast ? '3px solid #000000' : '1px solid rgba(71, 85, 105, 0.5)',
            borderRadius: '15px',
            padding: '30px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🛡️</div>
            <h3 style={{
              fontSize: '2rem',
              color: highContrast ? '#000000' : '#f1f5f9',
              margin: '0 0 10px 0'
            }}>
              {userProfile.safety_score || 0}%
            </h3>
            <p style={{
              fontSize: largeFontSize,
              color: highContrast ? '#000000' : '#94a3b8',
              margin: 0,
              fontWeight: 600
            }}>
              Safety Score
            </p>
          </div>
        </div>

        {/* Account Details */}
        <div style={{
          background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
          border: highContrast ? '3px solid #000000' : '1px solid rgba(71, 85, 105, 0.5)',
          borderRadius: '15px',
          padding: '30px',
          marginBottom: '40px'
        }}>
          <h2 style={{
            fontSize: '1.8rem',
            color: highContrast ? '#000000' : '#f1f5f9',
            marginTop: 0,
            marginBottom: '20px'
          }}>
            Account Details
          </h2>

          <div style={{
            display: 'grid',
            gap: '15px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '15px 0',
              borderBottom: highContrast ? '1px solid #000000' : '1px solid rgba(71, 85, 105, 0.3)'
            }}>
              <span style={{
                fontSize: largeFontSize,
                color: highContrast ? '#000000' : '#f1f5f9',
                fontWeight: 600
              }}>
                Account Type
              </span>
              <span style={{
                fontSize: largeFontSize,
                color: highContrast ? '#000000' : '#94a3b8'
              }}>
                {userProfile.is_premium ? 'Premium' : 'Free'}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '15px 0',
              borderBottom: highContrast ? '1px solid #000000' : '1px solid rgba(71, 85, 105, 0.3)'
            }}>
              <span style={{
                fontSize: largeFontSize,
                color: highContrast ? '#000000' : '#f1f5f9',
                fontWeight: 600
              }}>
                Member Since
              </span>
              <span style={{
                fontSize: largeFontSize,
                color: highContrast ? '#000000' : '#94a3b8'
              }}>
                {new Date(userProfile.created_at).toLocaleDateString()}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '15px 0',
              borderBottom: highContrast ? '1px solid #000000' : '1px solid rgba(71, 85, 105, 0.3)'
            }}>
              <span style={{
                fontSize: largeFontSize,
                color: highContrast ? '#000000' : '#f1f5f9',
                fontWeight: 600
              }}>
                Last Active
              </span>
              <span style={{
                fontSize: largeFontSize,
                color: highContrast ? '#000000' : '#94a3b8'
              }}>
                {new Date(userProfile.last_active).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '15px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => window.location.href = '/'}
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
            🔍 Scan Messages
          </button>

          {!userProfile.is_premium && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/stripe/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: userProfile.email })
                  });
                  const { url } = await res.json();
                  if (url) window.location.href = url;
                } catch (e) {
                  console.error("Checkout error:", e);
                  alert("Payment setup failed. Please check your Stripe API keys are configured correctly.");
                }
              }}
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
              💎 Upgrade to Premium
            </button>
          )}

          {userProfile.is_premium && (
            <button
              onClick={async () => {
                const res = await fetch("/api/stripe/portal", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({})
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
              ⚙️ Manage Subscription
            </button>
          )}
        </div>
      </main>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
