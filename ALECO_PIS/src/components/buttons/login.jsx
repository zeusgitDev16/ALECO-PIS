import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google'; 
import { jwtDecode } from "jwt-decode"; 
import '../../CSS/LoginContainer.css'; 
import API from '../../api/axiosConfig'; 

const Login = () => {
    const [showModal, setShowModal] = useState(false);
    const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false); 
    
    // FORGOT PASSWORD STATES
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [resetStep, setResetStep] = useState(1); // 1: Email, 2: Code & New Pass
    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    const [email, setEmail] = useState(''); 
    const [password, setPassword] = useState(''); 
    const [inviteCode, setInviteCode] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const navigate = useNavigate();

    // --- FORGOT PASSWORD HANDLERS ---
    const handleRequestReset = async (e) => {
        e.preventDefault();
        try {
            const response = await API.post('/api/forgot-password', { email: resetEmail });
            if (response.status === 200) {
                alert("Reset code sent! Check your email.");
                setResetStep(2);
            }
        } catch (error) {
            alert(error.response?.data?.error || "Failed to send reset code.");
        }
    };

    const handleFinalReset = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            alert("Passwords do not match.");
            return;
        }
        try {
            const response = await API.post('/api/reset-password', {
                email: resetEmail,
                code: resetCode,
                newPassword: newPassword
            });
            if (response.status === 200) {
                alert("Password reset successful! You can now log in.");
                setShowForgotModal(false);
                setResetStep(1);
                // Clear reset states
                setResetEmail('');
                setResetCode('');
                setNewPassword('');
                setConfirmNewPassword('');
            }
        } catch (error) {
            alert(error.response?.data?.error || "Reset failed.");
        }
    };

    const toggleForgotModal = () => {
        setShowForgotModal(!showForgotModal);
        setResetStep(1);
    };

    // HANDLER: The "Gatekeeper" for Google Auth
    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const decoded = jwtDecode(credentialResponse.credential);
            const userEmail = decoded.email;
            const profilePicUrl = decoded.picture;
            const userName = decoded.name;

            if (isFirstTimeSetup) {
                if (!inviteCode || inviteCode.length !== 12) {
                    alert("Please enter your 12-digit invite code first.");
                    return;
                }
                const response = await API.post('/api/setup-google-account', { 
                    email: userEmail,
                    inviteCode: inviteCode,
                    profilePic: profilePicUrl,
                    name: userName
                });
                if (response.status === 200) {
                    alert("Google account successfully linked!");
                    setIsFirstTimeSetup(false);
                }
            } else {
                const response = await API.post('/api/google-login', { 
                    email: userEmail,
                    profilePic: profilePicUrl, 
                    name: userName
                });

                if (response.status === 200) {
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
            alert(error.response?.data?.error || "Auth Error.");
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

    const handleFormSubmit = async (e) => {
        e.preventDefault(); 
        if (isFirstTimeSetup) {
            if (password !== confirmPassword) {
                alert("Passwords do not match.");
                return;
            }
            try {
                const response = await API.post('/api/setup-account', {
                    email: email,
                    inviteCode: inviteCode,
                    password: password
                });
                if (response.status === 200) {
                    alert("Account setup successful!");
                    setIsFirstTimeSetup(false); 
                }
            } catch (error) {
                alert(error.response?.data?.error || "Setup failed.");
            }
        } else {
            try {
                const response = await API.post('/api/login', { email: email, password: password });
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
                alert(error.response?.data?.error || "Login failed.");
            }
        }
    };

    return (
        <div className="Login-Container">
            <button className="main-login-btn" onClick={toggleModal}>Login</button>

            {/* MAIN LOGIN MODAL */}
            {showModal && (
                <div className="login-modal-overlay" onClick={(e) => e.target.className === 'login-modal-overlay' && setShowModal(false)}>
                    <form className="login-form" onSubmit={handleFormSubmit}>
                        <p id="login-heading">{isFirstTimeSetup ? "Account Setup" : "Login"}</p>
                        
                        <div className="login-field">
                            <input type="email" placeholder="Email Address" className="login-input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>

                        {isFirstTimeSetup && (
                            <div className="login-field">
                                <input type="text" placeholder="12-Digit Invite Code" className="login-input-field" maxLength="12" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
                            </div>
                        )}

                        <div className="login-field">
                            <input type="password" placeholder={isFirstTimeSetup ? "Create New Password" : "Password"} className="login-input-field" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>

                        {isFirstTimeSetup && (
                            <div className="login-field">
                                <input type="password" placeholder="Re-enter New Password" className="login-input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                            </div>
                        )}

                        <div className="login-btn-row">
                            <button className="login-button1" type="submit">{isFirstTimeSetup ? "Setup Account" : "Login"}</button>
                            <button className="login-button2" type="button" onClick={() => setIsFirstTimeSetup(!isFirstTimeSetup)}>
                                {isFirstTimeSetup ? "Back to Login" : "First Time Setup"}
                            </button>
                        </div>

                        <div style={{ marginTop: '15px', textAlign: 'center' }}>
                            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => alert("Google Auth Failed")} theme="filled_black" shape="pill" text={isFirstTimeSetup ? "signup_with" : "signin_with"} />
                        </div>

                        {!isFirstTimeSetup && (
                            <button className="login-button3" type="button" onClick={toggleForgotModal}>Forgot Password</button>
                        )}
                    </form>
                </div>
            )}

           {/* UPDATED FORGOT PASSWORD MODAL SECTION */}
{showForgotModal && (
    <div className="login-modal-overlay" onClick={(e) => e.target.className === 'login-modal-overlay' && setShowForgotModal(false)}>
        <form className="login-form" onSubmit={resetStep === 1 ? handleRequestReset : handleFinalReset}>
            <p id="login-heading">Reset Password</p>
            
            {resetStep === 1 ? (
                <>
                    <p style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>Enter your registered email to receive a reset code.</p>
                    <div className="login-field">
                        <input type="email" placeholder="Email Address" className="login-input-field" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                    </div>
                    <button className="login-button1" type="submit">Send Code</button>
                </>
            ) : (
                <>
                    {/* Updated placeholder and description for the 8-character code */}
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
    <p style={{ fontSize: '14px', color: '#888', margin: '0 0 10px 0' }}>
        Enter the 8-Character reset code sent to:
    </p>
    <p style={{ 
        fontSize: '1.4rem', 
        fontWeight: 'bold', 
        color: '#2e7d32', // Relaxing green
        margin: '5px 0',
        wordBreak: 'break-all'
    }}>
        {resetEmail}
    </p>
</div>
                    <div className="login-field">
                        <input 
                            type="text" 
                            placeholder="8-Character Reset Code" 
                            className="login-input-field" 
                            maxLength="8" 
                            value={resetCode} 
                            onChange={(e) => setResetCode(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="login-field">
                        <input type="password" placeholder="New Password" className="login-input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                    </div>
                    <div className="login-field">
                        <input type="password" placeholder="Confirm New Password" className="login-input-field" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required />
                    </div>
                    <button className="login-button1" type="submit">Reset Password</button>
                </>
            )}
            <button className="login-button2" type="button" style={{ marginTop: '10px' }} onClick={toggleForgotModal}>Cancel</button>
        </form>
    </div>
)}
        </div>
    );
};

export default Login;