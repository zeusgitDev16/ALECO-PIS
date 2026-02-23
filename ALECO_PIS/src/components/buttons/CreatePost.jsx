import React from 'react';
import '../../CSS/CreatePost.css';

const CreatePost = () => {
  return (
    <button className="create-post-btn">
      <span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span className="btn-text">Create Post</span>
      </span>
    </button>
  );
};

export default CreatePost;