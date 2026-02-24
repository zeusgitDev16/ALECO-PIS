import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../CSS/LoginContainer.css'; 
import API from '../../api/axiosConfig'; 

const Login = () => {
    const [showModal, setShowModal] = useState(false);
    
    // NEW: Toggle state between Phase 1 and Phase 2
    const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false); 
    
    // NEW: Updated states for the new flow
    const [email, setEmail] = useState(''); 
    const [password, setPassword] = useState(''); 
    const [inviteCode, setInviteCode] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const navigate = useNavigate();

    const toggleModal = () => {
        setShowModal(!showModal);
        // Clear all inputs and reset to standard login when opening/closing modal
        if (!showModal) {
            setEmail('');
            setPassword('');
            setInviteCode('');
            setConfirmPassword('');
            setIsFirstTimeSetup(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault(); 
        
        if (isFirstTimeSetup) {
            // PHASE 1: First-Time Setup Logic
            if (password !== confirmPassword) {
                alert("Passwords do not match. Please try again.");
                return;
            }

            try {
                // Send the setup package to your Node.js backend
                const response = await API.post('/api/setup-account', {
                    email: email,
                    inviteCode: inviteCode,
                    password: password
                });

                if (response.status === 200) {
                    alert("Account setup successful! You can now log in.");
                    
                    // Smoothly transition them back to the standard login view
                    setIsFirstTimeSetup(false); 
                    setPassword('');
                    setConfirmPassword('');
                    setInviteCode('');
                }
            } catch (error) {
                // Catch backend errors (like wrong code or already registered)
                if (error.response && error.response.data) {
                    alert(error.response.data.error); 
                } else {
                    console.error("Setup Error:", error);
                    alert("Communication failed. Is the Node.js server running?");
                }
            }
            
        } else {
            // PHASE 2: Standard Login Logic (Real Database Check)
            try {
                const response = await API.post('/api/login', {
                    email: email,
                    password: password
                });

                if (response.status === 200) {
                    console.log("Login Successful:", response.data.user);
                    
                    // Optional: Save their role so your dashboard knows what to show them
                    localStorage.setItem('userRole', response.data.user.role);
                    
                    setShowModal(false);
                    navigate('/admin-dashboard'); 
                }
            } catch (error) {
                // Catch "Invalid email or password" errors from the backend
                if (error.response && error.response.data) {
                    alert(error.response.data.error);
                } else {
                    console.error("Login Error:", error);
                    alert("Communication failed. Is the Node.js server running?");
                }
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
            {/* STRICTLY UNTOUCHED: Main trigger button */}
            <button className="main-login-btn" onClick={toggleModal}>Login</button>

            {showModal && (
                <div className="login-modal-overlay" onClick={handleBackdropClick}>
                    <form className="login-form" onSubmit={handleFormSubmit}>
                        {/* Dynamic Heading */}
                        <p id="login-heading">{isFirstTimeSetup ? "Account Setup" : "Login"}</p>
                        
                        {/* 1. EMAIL FIELD (Visible in both phases) */}
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

                        {/* 2. 12-DIGIT CODE (Phase 1 ONLY) */}
                        {isFirstTimeSetup && (
                            <div className="login-field">
                                {/* Key/Code icon */}
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

                        {/* 3. PASSWORD FIELD (Visible in both, placeholder changes) */}
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

                        {/* 4. RE-ENTER PASSWORD (Phase 1 ONLY) */}
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

                        {/* BUTTONS */}
                        <div className="login-btn-row">
                            <button className="login-button1" type="submit">
                                {isFirstTimeSetup ? "Setup Account" : "Login"}
                            </button>
                            
                            {/* Sign Up button is gone. Replaced with the mode toggle */}
                            <button 
                                className="login-button2" 
                                type="button" 
                                onClick={() => setIsFirstTimeSetup(!isFirstTimeSetup)}
                            >
                                {isFirstTimeSetup ? "Back to Login" : "First Time Setup"}
                            </button>
                        </div>
                        
                        {/* Forgot password hidden during First-Time Setup */}
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