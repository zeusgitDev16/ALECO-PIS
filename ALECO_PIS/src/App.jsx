import React from 'react'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import InterruptionList from './InterruptionList.jsx'
import LandingPage from './components/headers/landingPage.jsx';


function App() {
  
   return(
    <>
    <LandingPage/>
    <Navbar/>
    <InterruptionList/>
    <Footer/>
    </>

   );
}

export default App
