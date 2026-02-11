import React from 'react';
import '../../CSS/Navbar.css';


const Login = () => {
    const handleLogin = () => {
        console.log("Login button clicked!");
    }

    return (
        <div className = "Login-Container">
            <button className= "main-login-btn" onClick={handleLogin}>Login</button>
        </div>
    );
}

export default Login;