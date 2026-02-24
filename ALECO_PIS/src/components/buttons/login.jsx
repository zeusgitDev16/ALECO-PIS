import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google'; 
import { jwtDecode } from "jwt-decode"; 
import '../../CSS/LoginContainer.css'; 
import API from '../../api/axiosConfig'; 

const Login = () => {
    const [showModal, setShowModal] = useState(false);
    const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false); 
    const [email, setEmail] = useState(''); 
    const [password, setPassword] = useState(''); 
    const [inviteCode, setInviteCode] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const navigate = useNavigate();

    // HANDLER: The "Gatekeeper" for Google Auth
    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const decoded = jwtDecode(credentialResponse.credential);
            const userEmail = decoded.email;
            const profilePicUrl = decoded.picture;
            const userName = decoded.name;

            if (isFirstTimeSetup) {
                // PHASE 1: Linking Google for the first time
                // THE GUARD: They MUST have entered their 12-digit code first
                if (!inviteCode || inviteCode.length !== 12) {
                    alert("Please enter your 12-digit invite code first to link your Google account.");
                    return;
                }

                const response = await API.post('/api/setup-google-account', { 
                    email: userEmail,
                    inviteCode: inviteCode,
                    profilePic: profilePicUrl 
                });

                if (response.status === 200) {
                    alert("Google account successfully linked! You can now log in.");
                    setIsFirstTimeSetup(false); // Switch them to standard login mode
                }
            } else {
                // PHASE 2: Standard Login for existing users
                const response = await API.post('/api/google-login', { 
                    email: userEmail,
                    profilePic: profilePicUrl, 
                    name: userName
                });

                if (response.status === 200) {
                    // SUCCESS: Save roles and detected image for the dashboard
                    localStorage.setItem('userRole', response.data.user.role);
                    localStorage.setItem('googleProfilePic', profilePicUrl); 
                    localStorage.setItem('userName', userName);
                    localStorage.setItem('userEmail', userEmail); 
                    localStorage.setItem('tokenVersion', response.data.user.tokenVersion);
                    
                    setShowModal(false);
                    navigate('/admin-dashboard');
                }
            }
        } catch (error) {
            console.error("Auth Error:", error);
            // This catches unauthorized Google accounts that don't have a linked invite
            alert(error.response?.data?.error || "This account is not yet set up. Please use 'First Time Setup' with your 12-digit code.");
        }
    };

    const toggleModal = () => {
        setShowModal(!showModal);
        if (!showModal) {
            setEmail('');
            setPassword('');
            setInviteCode('');
            setConfirmPassword('');
            setIsFirstTimeSetup(false);
        }
    };

    // Standard Email/Password Submission
    const handleFormSubmit = async (e) => {
        e.preventDefault(); 
        if (isFirstTimeSetup) {
            if (password !== confirmPassword) {
                alert("Passwords do not match. Please try again.");
                return;
            }
            try {
                const response = await API.post('/api/setup-account', {
                    email: email,
                    inviteCode: inviteCode,
                    password: password
                });
                if (response.status === 200) {
                    alert("Account setup successful! You can now log in.");
                    setIsFirstTimeSetup(false); 
                    setPassword('');
                    setConfirmPassword('');
                    setInviteCode('');
                }
            } catch (error) {
                alert(error.response?.data?.error || "Communication failed.");
            }
        } else {
            try {
                const response = await API.post('/api/login', {
                    email: email,
                    password: password
                });
                if (response.status === 200) {
                    localStorage.setItem('userRole', response.data.user.role);
                    localStorage.setItem('googleProfilePic', response.data.user.profilePic);
                    localStorage.setItem('userName', response.data.user.name || 'User');
                    localStorage.setItem('userEmail', response.data.user.email);
                    localStorage.setItem('tokenVersion', response.data.user.tokenVersion);
                    setShowModal(false);
                    navigate('/admin-dashboard'); 
                }
            } catch (error) {
                alert(error.response?.data?.error || "Communication failed.");
            }
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target.className === 'login-modal-overlay') {
            setShowModal(false);
        }
    };

    return (
        <div className="Login-Container">
            <button className="main-login-btn" onClick={toggleModal}>Login</button>

            {showModal && (
                <div className="login-modal-overlay" onClick={handleBackdropClick}>
                    <form className="login-form" onSubmit={handleFormSubmit}>
                        <p id="login-heading">{isFirstTimeSetup ? "Account Setup" : "Login"}</p>
                        
                        {/* 1. EMAIL (Always visible) */}
                        <div className="login-field">
                            <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.106 7.222c0-2.967-2.249-5.032-5.482-5.032-3.35 0-5.646 2.318-5.646 5.702 0 3.493 2.235 5.708 5.762 5.708.862 0 1.689-.123 2.304-.335v-.862c-.43.199-1.354.328-2.29.328-2.926 0-4.813-1.88-4.813-4.798 0-2.844 1.921-4.881 4.594-4.881 2.735 0 4.608 1.688 4.608 4.156 0 1.682-.554 2.769-1.416 2.769-.492 0-.772-.28-.772-.76V5.206H8.923v.834h-.11c-.266-.595-.881-.964-1.6-.964-1.4 0-2.378 1.162-2.378 2.823 0 1.737.957 2.906 2.379 2.906.8 0 1.415-.39 1.709-1.087h.11c.081.67.703 1.148 1.503 1.148 1.572 0 2.57-1.415 2.57-3.643zm-7.177.704c0-1.197.54-1.907 1.456-1.907.93 0 1.524.738 1.524 1.907S8.308 9.84 7.371 9.84c-.895 0-1.442-.725-1.442-1.914z"></path>
                            </svg>
                            <input 
                                autoComplete="off" 
                                placeholder="Email Address" 
                                className="login-input-field" 
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required 
                            />
                        </div>

                        {/* 2. 12-DIGIT CODE (First Time Setup ONLY) */}
                        {isFirstTimeSetup && (
                            <div className="login-field">
                                <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M3.5 11.5a3.5 3.5 0 1 1 3.163-5h1.146c.16 0 .314.05.44.14l4.98 3.557c.275.197.35.58.154.856l-.54.756a.6.6 0 0 1-.856.154l-1.35-1.037-.624.874a.6.6 0 0 1-.856.154l-1.35-1.037-.624.874a.6.6 0 0 1-.856.154l-2.022-1.554A3.5 3.5 0 0 1 3.5 11.5zm0-5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                                </svg>
                                <input 
                                    autoComplete="off" 
                                    placeholder="12-Digit Invite Code" 
                                    className="login-input-field" 
                                    type="text"
                                    maxLength="12"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value)}
                                    required={isFirstTimeSetup}
                                />
                            </div>
                        )}

                        {/* 3. PASSWORD (Placeholder changes based on mode) */}
                        <div className="login-field">
                            <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path>
                            </svg>
                            <input 
                                placeholder={isFirstTimeSetup ? "Create New Password" : "Password"} 
                                className="login-input-field" 
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                            />
                        </div>

                        {/* 4. CONFIRM PASSWORD (Setup ONLY) */}
                        {isFirstTimeSetup && (
                            <div className="login-field">
                                <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path>
                                </svg>
                                <input 
                                    placeholder="Re-enter New Password" 
                                    className="login-input-field" 
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required={isFirstTimeSetup}
                                />
                            </div>
                        )}

                        <div className="login-btn-row">
                            <button className="login-button1" type="submit">
                                {isFirstTimeSetup ? "Setup Account" : "Login"}
                            </button>
                            <button 
                                className="login-button2" 
                                type="button" 
                                onClick={() => setIsFirstTimeSetup(!isFirstTimeSetup)}
                            >
                                {isFirstTimeSetup ? "Back to Login" : "First Time Setup"}
                            </button>
                        </div>

                        {/* DYNAMIC GOOGLE SECTION */}
                        <div style={{ marginTop: '15px', textAlign: 'center' }}>
                            <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                                {isFirstTimeSetup ? "Or link your invitation to Google:" : "Or sign in instantly:"}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <GoogleLogin 
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => alert("Google Auth Failed")}
                                    theme="filled_black"
                                    shape="pill"
                                    text={isFirstTimeSetup ? "signup_with" : "signin_with"}
                                />
                            </div>
                        </div>

                        {!isFirstTimeSetup && (
                            <button className="login-button3" type="button">Forgot Password</button>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
};

export default Login;