import React from 'react';

function Footer (){

    return (
       <footer className="footer-container">
  <p className="footer-text">
    &copy; {new Date().getFullYear()} ALECO's Power Information System, all rights reserved.
  </p>
</footer>
    );

}

export default Footer